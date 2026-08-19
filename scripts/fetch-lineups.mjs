#!/usr/bin/env node
// Fetches CONFIRMED match-day lineups (starting XI + substitutes) from
// API-Football for any of our upcoming PL fixtures that are imminent.
// Official team sheets aren't published until ~20-40 min before kickoff,
// so this is designed to run frequently (every ~15 min via a scheduled
// workflow) and do nothing - zero API calls - unless a match is close.
//
// Requires API_FOOTBALL_KEY in the environment.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "public", "data.json");
const OUT_PATH = path.join(__dirname, "..", "public", "lineups.json");

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
if (!API_FOOTBALL_KEY) {
  console.error("Missing API_FOOTBALL_KEY env var.");
  process.exit(1);
}

const API_BASE = "https://v3.football.api-sports.io";
const PL_LEAGUE_ID = 39; // API-Football's id for the Premier League

// How soon a match must be (in ms) before we start polling for its lineup,
// and how long after kickoff we keep trying in case it wasn't posted yet.
const LOOKAHEAD_MS = 3 * 60 * 60 * 1000; // 3 hours before kickoff
const GRACE_PERIOD_MS = 90 * 60 * 1000; // keep trying up to 90 min after kickoff
// Once a match is this old, drop it from lineups.json so the file doesn't
// grow forever.
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

async function apiFootballRequest(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (body.errors && Object.keys(body.errors).length > 0) {
    throw new Error(`API-Football ${endpoint} returned errors: ${JSON.stringify(body.errors)}`);
  }
  return body.response ?? [];
}

function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/\bfc\b|\bafc\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Clubs whose API-Football name doesn't share a word with the
// football-data.org name, so substring matching alone can't connect them.
const NAME_ALIASES = {
  wolverhampton: ["wolves"],
  "wolverhampton wanderers": ["wolves"],
};

function teamsLikelyMatch(ourTeam, theirName) {
  const ours = [normalizeTeamName(ourTeam.name), normalizeTeamName(ourTeam.shortName)];
  const withAliases = ours.flatMap((name) => [name, ...(NAME_ALIASES[name] ?? [])]);
  const theirs = normalizeTeamName(theirName);
  return withAliases.some(
    (name) => name === theirs || theirs.includes(name) || name.includes(theirs),
  );
}

async function findApiFootballFixtureId(ourMatch, season) {
  const date = ourMatch.utcDate.slice(0, 10); // YYYY-MM-DD
  const fixtures = await apiFootballRequest(
    `/fixtures?league=${PL_LEAGUE_ID}&season=${season}&date=${date}`,
  );

  const match = fixtures.find(
    (f) =>
      teamsLikelyMatch(ourMatch.homeTeam, f.teams?.home?.name ?? "") &&
      teamsLikelyMatch(ourMatch.awayTeam, f.teams?.away?.name ?? ""),
  );

  return match?.fixture?.id ?? null;
}

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

  const existingLineups = pruneStale(await loadExistingLineups());

  if (imminentMatches.length === 0) {
    console.log("No imminent fixtures - skipping API-Football calls to save quota.");
    await mkdir(path.dirname(OUT_PATH), { recursive: true });
    await writeFile(
      OUT_PATH,
      JSON.stringify({ fetchedAt: new Date().toISOString(), lineups: existingLineups }, null, 2) +
        "\n",
    );
    return;
  }

  console.log(`Found ${imminentMatches.length} imminent fixture(s), checking for lineups...`);

  const lineups = { ...existingLineups };

  for (const match of imminentMatches) {
    if (lineups[match.id]?.byTeam) {
      console.log(`  ${match.homeTeam.shortName} v ${match.awayTeam.shortName}: already have it`);
      continue;
    }

    // API-Football identifies a season by its starting year, which for a
    // fixture in Jan-Jun is the previous calendar year.
    const kickoff = new Date(match.utcDate);
    const season =
      kickoff.getUTCMonth() < 6 ? kickoff.getUTCFullYear() - 1 : kickoff.getUTCFullYear();

    try {
      const fixtureId = await findApiFootballFixtureId(match, season);
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
