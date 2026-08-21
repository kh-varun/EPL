#!/usr/bin/env node
// Fetches CONFIRMED match-day lineups (starting XI + substitutes) from
// API-Football for any of our upcoming PL fixtures that are imminent.
// Official team sheets aren't published until ~20-40 min before kickoff,
// so this is designed to run frequently (every ~15 min via a scheduled
// workflow) and do nothing - zero API calls - unless a match is close.
//
// API-Football is the primary source. Two optional sources cross-check it
// once it returns a lineup - never on their own - and any disagreement is
// only logged, not shown to users, so a wrong secondary source can't corrupt
// what ships:
//   - ESPN's public but unofficial/undocumented site API (no key, no signup).
//   - Highlightly's free tier (100 req/day, no card - HIGHLIGHTLY_API_KEY),
//     skipped entirely when that key isn't set.
//
// Requires API_FOOTBALL_KEY in the environment.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { apiFootballRequest, teamsLikelyMatch, findApiFootballFixtureId } from "./lib/api-football.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "public", "data.json");
const OUT_PATH = path.join(__dirname, "..", "public", "lineups.json");

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
if (!API_FOOTBALL_KEY) {
  console.error("Missing API_FOOTBALL_KEY env var.");
  process.exit(1);
}
// Optional: adds a second, independent cross-check of API-Football's
// confirmed lineup. Sign up free at https://highlightly.net (no card) and
// set HIGHLIGHTLY_API_KEY - without it this path is skipped entirely, same
// as every other optional key in this project.
const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY;

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1";
const HIGHLIGHTLY_BASE = "https://soccer.highlightly.net";

// How soon a match must be (in ms) before we start polling for its lineup,
// and how long after kickoff we keep trying in case it wasn't posted yet.
const LOOKAHEAD_MS = 3 * 60 * 60 * 1000; // 3 hours before kickoff
const GRACE_PERIOD_MS = 90 * 60 * 1000; // keep trying up to 90 min after kickoff
// Once a match is this old, drop it from lineups.json so the file doesn't
// grow forever.
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

function mapLineupSide(sideData) {
  if (!sideData) return null;
  return {
    teamName: sideData.team?.name ?? null,
    formation: sideData.formation ?? null,
    startXI: (sideData.startXI ?? []).map((p) => ({
      id: p.player.id,
      name: p.player.name,
      number: p.player.number,
      position: p.player.pos,
      grid: p.player.grid,
    })),
    substitutes: (sideData.substitutes ?? []).map((p) => ({
      id: p.player.id,
      name: p.player.name,
      number: p.player.number,
      position: p.player.pos,
    })),
    coach: sideData.coach?.name ?? null,
  };
}

// Keys each side to OUR team id, so the UI can look a lineup up directly
// by team rather than guessing which side is which.
async function fetchLineupForFixture(fixtureId, ourMatch) {
  const response = await apiFootballRequest(`/fixtures/lineups?fixture=${fixtureId}`);
  if (response.length < 2) return null; // not published yet

  const byTeamId = {};
  for (const side of response) {
    const theirName = side.team?.name ?? "";
    if (teamsLikelyMatch(ourMatch.homeTeam, theirName)) {
      byTeamId[ourMatch.homeTeam.id] = mapLineupSide(side);
    } else if (teamsLikelyMatch(ourMatch.awayTeam, theirName)) {
      byTeamId[ourMatch.awayTeam.id] = mapLineupSide(side);
    }
  }

  return Object.keys(byTeamId).length === 2 ? byTeamId : null;
}

// --- Cross-checks (best-effort only - never the primary source) ---

function startingNames(side) {
  return new Set(
    (side?.startXI ?? []).map((p) => p.name?.toLowerCase().trim()).filter(Boolean),
  );
}

// Logs a warning when a secondary source's starting XI disagrees with
// API-Football's, so mismatches are visible in the Actions log - but never
// changes what gets written to lineups.json. API-Football stays the single
// source of truth users see; this is purely a confidence signal for us.
function logLineupAgreement(primarySide, secondarySide, sourceLabel, teamLabel) {
  const primaryNames = startingNames(primarySide);
  const secondaryNames = startingNames(secondarySide);
  if (primaryNames.size === 0 || secondaryNames.size === 0) return;

  const onlyInPrimary = [...primaryNames].filter((n) => !secondaryNames.has(n));
  const onlyInSecondary = [...secondaryNames].filter((n) => !primaryNames.has(n));
  if (onlyInPrimary.length === 0 && onlyInSecondary.length === 0) {
    console.log(`    ${teamLabel}: confirmed by ${sourceLabel} too - lineups match.`);
    return;
  }
  console.warn(
    `    ${teamLabel}: ${sourceLabel} DISAGREES with API-Football (using API-Football) - ` +
      `only in API-Football: [${onlyInPrimary.join(", ") || "none"}], ` +
      `only in ${sourceLabel}: [${onlyInSecondary.join(", ") || "none"}]`,
  );
}

async function espnRequest(path) {
  const res = await fetch(`${ESPN_BASE}${path}`);
  if (!res.ok) throw new Error(`ESPN ${path} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// ESPN's site API is public but unofficial and undocumented (no key, no
// signup) - used only to cross-check API-Football, never as a primary
// source, since it can change shape or disappear without notice.
async function findEspnEventId(ourMatch) {
  const date = ourMatch.utcDate.slice(0, 10).replace(/-/g, "");
  const data = await espnRequest(`/scoreboard?dates=${date}`);
  const event = (data.events ?? []).find((e) => {
    const competitors = e.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    return (
      home &&
      away &&
      teamsLikelyMatch(ourMatch.homeTeam, home.team?.displayName ?? "") &&
      teamsLikelyMatch(ourMatch.awayTeam, away.team?.displayName ?? "")
    );
  });
  return event?.id ?? null;
}

async function fetchEspnLineup(eventId, ourMatch) {
  const data = await espnRequest(`/summary?event=${eventId}`);
  const rosters = data.rosters ?? [];
  if (rosters.length === 0) return null;

  const byTeamId = {};
  for (const roster of rosters) {
    const teamName = roster.team?.displayName ?? roster.team?.name ?? "";
    const entries = roster.roster ?? roster.athletes ?? [];
    const startXI = entries
      .filter((p) => p.starter)
      .map((p) => ({ name: p.athlete?.displayName ?? p.athlete?.fullName ?? null }))
      .filter((p) => p.name);
    if (startXI.length === 0) continue;

    if (teamsLikelyMatch(ourMatch.homeTeam, teamName)) {
      byTeamId[ourMatch.homeTeam.id] = { startXI };
    } else if (teamsLikelyMatch(ourMatch.awayTeam, teamName)) {
      byTeamId[ourMatch.awayTeam.id] = { startXI };
    }
  }

  if (Object.keys(byTeamId).length === 0) {
    // Unexpected response shape - dump what we got so a live run's log
    // tells us what changed, per this repo's ship-logging-first convention.
    console.log(
      `    ESPN: couldn't map any roster to our teams - sample roster keys: ` +
        `[${Object.keys(rosters[0] ?? {}).join(", ")}]`,
    );
  }
  return byTeamId;
}

async function crossCheckEspn(match, primaryByTeam) {
  try {
    const eventId = await findEspnEventId(match);
    if (!eventId) {
      console.log(`    ESPN: no matching event found`);
      return;
    }
    const espnByTeam = await fetchEspnLineup(eventId, match);
    for (const [teamId, side] of Object.entries(primaryByTeam)) {
      const label = String(teamId) === String(match.homeTeam.id) ? "home" : "away";
      logLineupAgreement(side, espnByTeam?.[teamId], "ESPN", label);
    }
  } catch (err) {
    console.error(`    ESPN cross-check failed: ${err.message}`);
  }
}

// Highlightly's free tier (100 req/day, no card - see HIGHLIGHTLY_API_KEY
// above). NOTE: the endpoint paths and response shape below are our best
// reading of public docs/search results - highlightly.net's own docs pages
// aren't reachable from this dev sandbox to confirm exactly, so treat this
// as provisional until it's been run for real once a key is configured
// (same ship-logging-then-iterate approach used to land the Kalshi and
// API-Football integrations).
async function highlightlyRequest(path) {
  const res = await fetch(`${HIGHLIGHTLY_BASE}${path}`, {
    headers: { "x-api-key": HIGHLIGHTLY_API_KEY },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `Highlightly ${path} failed: ${res.status} ${res.statusText} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function findHighlightlyMatchId(ourMatch) {
  const date = ourMatch.utcDate.slice(0, 10);
  const data = await highlightlyRequest(
    `/matches?date=${date}&leagueName=${encodeURIComponent("Premier League")}`,
  );
  const matches = Array.isArray(data) ? data : (data?.data ?? []);
  const match = matches.find(
    (m) =>
      teamsLikelyMatch(ourMatch.homeTeam, m.homeTeam?.name ?? "") &&
      teamsLikelyMatch(ourMatch.awayTeam, m.awayTeam?.name ?? ""),
  );
  if (!match) {
    console.log(
      `    Highlightly: no matching fixture in [${matches.map((m) => `${m.homeTeam?.name}-${m.awayTeam?.name}`).join(", ")}]`,
    );
  }
  return match?.id ?? null;
}

async function fetchHighlightlyLineup(matchId, ourMatch) {
  const data = await highlightlyRequest(`/lineups/${matchId}`);
  const sides = data?.data ?? data ?? [];
  const list = Array.isArray(sides) ? sides : [sides];

  const byTeamId = {};
  for (const side of list) {
    const teamName = side.team?.name ?? side.teamName ?? "";
    const players = side.startingLineup ?? side.startXI ?? side.players ?? [];
    const startXI = players
      .map((p) => ({ name: p.player?.name ?? p.name ?? null }))
      .filter((p) => p.name);
    if (startXI.length === 0) continue;

    if (teamsLikelyMatch(ourMatch.homeTeam, teamName)) {
      byTeamId[ourMatch.homeTeam.id] = { startXI };
    } else if (teamsLikelyMatch(ourMatch.awayTeam, teamName)) {
      byTeamId[ourMatch.awayTeam.id] = { startXI };
    }
  }

  if (Object.keys(byTeamId).length === 0) {
    console.log(
      `    Highlightly: couldn't map lineup response to our teams - raw shape: ` +
        `[${Object.keys(list[0] ?? {}).join(", ")}]`,
    );
  }
  return byTeamId;
}

async function crossCheckHighlightly(match, primaryByTeam) {
  if (!HIGHLIGHTLY_API_KEY) return;
  try {
    const matchId = await findHighlightlyMatchId(match);
    if (!matchId) return;
    const highlightlyByTeam = await fetchHighlightlyLineup(matchId, match);
    for (const [teamId, side] of Object.entries(primaryByTeam)) {
      const label = String(teamId) === String(match.homeTeam.id) ? "home" : "away";
      logLineupAgreement(side, highlightlyByTeam?.[teamId], "Highlightly", label);
    }
  } catch (err) {
    console.error(`    Highlightly cross-check failed: ${err.message}`);
  }
}

async function loadExistingLineups() {
  try {
    const raw = await readFile(OUT_PATH, "utf-8");
    return JSON.parse(raw).lineups ?? {};
  } catch {
    return {};
  }
}

function pruneStale(lineups) {
  const cutoff = Date.now() - PRUNE_AFTER_MS;
  const pruned = {};
  for (const [matchId, entry] of Object.entries(lineups)) {
    if (new Date(entry.utcDate).getTime() >= cutoff) pruned[matchId] = entry;
  }
  return pruned;
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, "utf-8"));
  const now = Date.now();

  const imminentMatches = (data.nextFixtures ?? []).filter((m) => {
    const kickoff = new Date(m.utcDate).getTime();
    return kickoff - now <= LOOKAHEAD_MS && now - kickoff <= GRACE_PERIOD_MS;
  });

  const rawExisting = await loadExistingLineups();
  const existingLineups = pruneStale(rawExisting);

  if (imminentMatches.length === 0) {
    console.log("No imminent fixtures - skipping API-Football calls to save quota.");
    // Only touch the file (and bump fetchedAt) if pruning actually removed
    // something. Otherwise leave it alone so there's nothing to commit -
    // this job runs every 15 minutes and would otherwise trigger a pointless
    // redeploy on every single run, forever.
    if (JSON.stringify(existingLineups) !== JSON.stringify(rawExisting)) {
      await mkdir(path.dirname(OUT_PATH), { recursive: true });
      await writeFile(
        OUT_PATH,
        JSON.stringify({ fetchedAt: new Date().toISOString(), lineups: existingLineups }, null, 2) +
          "\n",
      );
    }
    return;
  }

  console.log(`Found ${imminentMatches.length} imminent fixture(s), checking for lineups...`);

  const lineups = { ...existingLineups };

  for (const match of imminentMatches) {
    if (lineups[match.id]?.byTeam) {
      console.log(`  ${match.homeTeam.shortName} v ${match.awayTeam.shortName}: already have it`);
      continue;
    }

    try {
      const fixtureId = await findApiFootballFixtureId(match);
      if (!fixtureId) {
        console.log(
          `  ${match.homeTeam.shortName} v ${match.awayTeam.shortName}: no matching API-Football fixture found`,
        );
        continue;
      }

      const byTeam = await fetchLineupForFixture(fixtureId, match);
      if (!byTeam) {
        console.log(
          `  ${match.homeTeam.shortName} v ${match.awayTeam.shortName}: not published yet`,
        );
        continue;
      }

      lineups[match.id] = {
        utcDate: match.utcDate,
        homeTeamId: match.homeTeam.id,
        awayTeamId: match.awayTeam.id,
        byTeam,
      };
      console.log(`  ${match.homeTeam.shortName} v ${match.awayTeam.shortName}: got it`);

      // Cross-check against independent sources for confidence - logged only,
      // API-Football's lineup above is still what gets written and shown.
      await crossCheckEspn(match, byTeam);
      await crossCheckHighlightly(match, byTeam);
    } catch (err) {
      console.error(
        `  ${match.homeTeam.shortName} v ${match.awayTeam.shortName}: ${err.message}`,
      );
    }
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify({ fetchedAt: new Date().toISOString(), lineups }, null, 2) + "\n",
  );
  console.log(`Wrote ${OUT_PATH} (${Object.keys(lineups).length} match(es))`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
