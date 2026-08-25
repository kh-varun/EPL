#!/usr/bin/env node
// Fetches LIVE scores for any Premier League match currently in progress,
// so the dashboard can show up-to-date scores while a game is being
// played. Designed to run every ~10 minutes via a scheduled workflow, and
// does nothing - zero API calls - unless some match's kickoff window
// overlaps right now. Once a match that was live drops off the IN_PLAY/
// PAUSED list, it also refreshes standings/lastResults/nextFixtures in
// data.json - otherwise a finished match would keep showing as an
// upcoming fixture, and the table wouldn't reflect its result, until the
// next weekly fetch.mjs run - and, if API_FOOTBALL_KEY is set, fetches that
// match's team stats (shots, possession, passes, cards, etc.) and goal
// scorers once, caching them permanently in match-stats.json for the
// Results tab's stats dialog. API-Football is tried first (more precise,
// structured data) but falls back to ESPN's free public site API - no key
// needed - whenever API-Football can't serve the match at all (no key, no
// quota, or the fixture's date has aged out of the free plan's rolling
// date-window restriction - see CLAUDE.md).
//
// Requires FOOTBALL_DATA_TOKEN in the environment. API_FOOTBALL_KEY is
// optional - match stats just come from ESPN alone without it.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  footballDataRequest,
  fetchStandings,
  fetchLastResults,
  fetchNextFixtures,
} from "./lib/football-data.mjs";
import {
  apiFootballRequest,
  teamsLikelyMatch,
  findApiFootballFixtureId,
  hasApiFootballQuotaFor,
} from "./lib/api-football.mjs";
import { espnRequest, findEspnEventId } from "./lib/espn.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "public", "data.json");
const OUT_PATH = path.join(__dirname, "..", "public", "live-scores.json");
const MATCH_STATS_PATH = path.join(__dirname, "..", "public", "match-stats.json");

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FOOTBALL_DATA_TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN env var.");
  process.exit(1);
}

// Optional: team stats (shots, possession, passes, cards, etc.) for the
// Results tab's stats dialog. Everything still works without it - a
// finished match just won't have a stats breakdown.
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

// Optional manual override (see live-scores.yml's workflow_dispatch input):
// force-fetches stats for this one match id from lastResults, bypassing the
// normal just-finished-transition detection below. Needed for a match that
// finished before this feature existed - by the time the feature shipped,
// live-scores.json had already cleared that match's "was live" entry, so
// there was no transition left to detect naturally.
const MATCH_STATS_BACKFILL_ID = process.env.MATCH_STATS_BACKFILL_ID || null;

// Start checking a bit before the scheduled kickoff (matches sometimes go
// IN_PLAY a few minutes early) and keep checking for a few hours after in
// case of delays - stoppage time, weather, whatever. Once the match is
// actually FINISHED it drops out of the IN_PLAY/PAUSED query on its own.
const LOOKAHEAD_MS = 15 * 60 * 1000;
const MAX_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;

// A match that was live last run but isn't anymore has finished (or, rarely,
// been postponed/abandoned) - either way nextFixtures/lastResults/standings
// are now stale. Re-pull just those three from football-data.org; no need to
// touch teams/headlines, which don't change mid-match.
async function refreshCoreData() {
  const [standings, lastResults, nextFixtures] = await Promise.all([
    fetchStandings(),
    fetchLastResults(5),
    fetchNextFixtures(10),
  ]);

  const data = JSON.parse(await readFile(DATA_PATH, "utf-8"));
  data.standings = standings;
  data.lastResults = lastResults;
  data.nextFixtures = nextFixtures;
  data.fetchedAt = new Date().toISOString();

  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`Refreshed standings/lastResults/nextFixtures in ${DATA_PATH}`);

  return lastResults;
}

// API-Football's stat "type" strings, mapped to the clean shape the stats
// dialog renders. Field names/casing confirmed against API-Football's
// documented /fixtures/statistics response shape.
function mapFixtureStats(rawStats) {
  const byType = Object.fromEntries((rawStats ?? []).map((s) => [s.type, s.value]));
  const percent = (value) => {
    const n = typeof value === "string" ? parseInt(value, 10) : value;
    return Number.isFinite(n) ? n : null;
  };
  return {
    shots: byType["Total Shots"] ?? null,
    shotsOnTarget: byType["Shots on Goal"] ?? null,
    possession: percent(byType["Ball Possession"]),
    passes: byType["Total passes"] ?? null,
    passAccuracy: percent(byType["Passes %"]),
    fouls: byType["Fouls"] ?? null,
    corners: byType["Corner Kicks"] ?? null,
    offsides: byType["Offsides"] ?? null,
    yellowCards: byType["Yellow Cards"] ?? null,
    redCards: byType["Red Cards"] ?? null,
  };
}

async function fetchFixtureStatistics(fixtureId, ourMatch) {
  const response = await apiFootballRequest(`/fixtures/statistics?fixture=${fixtureId}`);
  if (response.length < 2) return null; // not published yet

  const byTeamId = {};
  for (const side of response) {
    const theirName = side.team?.name ?? "";
    if (teamsLikelyMatch(ourMatch.homeTeam, theirName)) {
      byTeamId[ourMatch.homeTeam.id] = mapFixtureStats(side.statistics);
    } else if (teamsLikelyMatch(ourMatch.awayTeam, theirName)) {
      byTeamId[ourMatch.awayTeam.id] = mapFixtureStats(side.statistics);
    }
  }
  return Object.keys(byTeamId).length === 2 ? byTeamId : null;
}

// Goal scorers + minute, for the stats dialog's scoring summary. Sourced
// from /fixtures/events rather than parsed out of the stats call above -
// API-Football reports goals as timeline events, not a statistic.
async function fetchFixtureGoals(fixtureId, ourMatch) {
  const events = await apiFootballRequest(`/fixtures/events?fixture=${fixtureId}`);
  return events
    .filter((e) => e.type === "Goal")
    .map((e) => {
      const theirName = e.team?.name ?? "";
      const teamId = teamsLikelyMatch(ourMatch.homeTeam, theirName)
        ? ourMatch.homeTeam.id
        : teamsLikelyMatch(ourMatch.awayTeam, theirName)
          ? ourMatch.awayTeam.id
          : null;
      return {
        teamId,
        player: e.player?.name ?? null,
        minute: e.time?.elapsed ?? null,
        extraMinute: e.time?.extra ?? null,
        ownGoal: e.detail === "Own Goal",
        penalty: e.detail === "Penalty",
      };
    })
    .filter((g) => g.teamId && g.player && g.minute != null)
    .sort((a, b) => a.minute - b.minute || (a.extraMinute ?? 0) - (b.extraMinute ?? 0));
}

// ESPN's own stat "name" strings for a soccer boxscore, mapped to the same
// clean shape mapFixtureStats produces from API-Football - best-effort
// reading of ESPN's public (but undocumented) response shape, since ESPN's
// own docs aren't reachable to confirm exactly. Tries a couple of aliases
// per field since ESPN's naming isn't fully consistent across sports/write-ups.
function mapEspnStats(statsArray) {
  const byName = Object.fromEntries(
    (statsArray ?? []).map((s) => [s.name, s.displayValue ?? s.value ?? null]),
  );
  const pick = (...names) => {
    for (const name of names) {
      if (byName[name] != null) return byName[name];
    }
    return null;
  };
  const num = (value) => {
    const n = typeof value === "string" ? parseFloat(value) : value;
    return Number.isFinite(n) ? n : null;
  };
  return {
    shots: num(pick("totalShots", "shotsTotal")),
    shotsOnTarget: num(pick("shotsOnTarget", "onTargetScoringAtt")),
    possession: num(pick("possessionPct", "possession")),
    passes: num(pick("totalPasses", "passes")),
    passAccuracy: num(pick("passPct", "passingAccuracy")),
    fouls: num(pick("foulsCommitted", "fouls")),
    corners: num(pick("cornerKicks", "wonCorners")),
    offsides: num(pick("offsides")),
    yellowCards: num(pick("yellowCards")),
    redCards: num(pick("redCards")),
  };
}

// Fallback source for match stats + scorers, used whenever API-Football
// can't serve the match at all (no key, quota exhausted, or - the common
// case for anything more than a day or two old - its free plan's rolling
// date-window restriction on /fixtures?date=, see CLAUDE.md). ESPN's site
// API has no such restriction and needs no key, but is unofficial/
// undocumented, so this dumps the raw shape on anything unexpected rather
// than silently guessing wrong, per this repo's ship-logging-first
// convention for unverified integrations.
async function fetchEspnMatchData(ourMatch) {
  const eventId = await findEspnEventId(ourMatch);
  if (!eventId) {
    console.log(`    ESPN: no matching event found`);
    return null;
  }

  const data = await espnRequest(`/summary?event=${eventId}`);
  const boxscoreTeams = data.boxscore?.teams ?? [];
  const byTeamId = {};
  for (const entry of boxscoreTeams) {
    const teamName = entry.team?.displayName ?? entry.team?.name ?? "";
    if (teamsLikelyMatch(ourMatch.homeTeam, teamName)) {
      byTeamId[ourMatch.homeTeam.id] = mapEspnStats(entry.statistics);
    } else if (teamsLikelyMatch(ourMatch.awayTeam, teamName)) {
      byTeamId[ourMatch.awayTeam.id] = mapEspnStats(entry.statistics);
    }
  }
  if (Object.keys(byTeamId).length !== 2) {
    console.log(
      `    ESPN: couldn't map boxscore to both teams - sample team keys: ` +
        `[${Object.keys(boxscoreTeams[0] ?? {}).join(", ")}], ` +
        `sample stat names: [${(boxscoreTeams[0]?.statistics ?? []).map((s) => s.name).join(", ")}]`,
    );
    return null;
  }

  const keyEvents = data.keyEvents ?? [];
  const scorers = keyEvents
    .filter((e) => e.scoringPlay === true || e.type?.text === "Goal")
    .map((e) => {
      const teamId =
        String(e.team?.id) === String(ourMatch.homeTeam.id)
          ? ourMatch.homeTeam.id
          : String(e.team?.id) === String(ourMatch.awayTeam.id)
            ? ourMatch.awayTeam.id
            : null;
      const minuteMatch = /(\d+)(?:\+(\d+))?/.exec(e.clock?.displayValue ?? "");
      return {
        teamId,
        player: e.athletesInvolved?.[0]?.displayName ?? null,
        minute: minuteMatch ? Number(minuteMatch[1]) : null,
        extraMinute: minuteMatch?.[2] ? Number(minuteMatch[2]) : null,
        ownGoal: /own goal/i.test(e.text ?? ""),
        penalty: /penalty/i.test(e.text ?? ""),
      };
    })
    .filter((g) => g.teamId && g.player && g.minute != null)
    .sort((a, b) => a.minute - b.minute || (a.extraMinute ?? 0) - (b.extraMinute ?? 0));

  if (keyEvents.length > 0 && scorers.length === 0) {
    console.log(
      `    ESPN: found ${keyEvents.length} key event(s) but none mapped to a goal - ` +
        `sample event keys: [${Object.keys(keyEvents[0] ?? {}).join(", ")}], ` +
        `sample type: ${JSON.stringify(keyEvents[0]?.type)}`,
    );
  }

  return { stats: byTeamId, scorers };
}

async function loadExistingMatchStats() {
  try {
    const raw = await readFile(MATCH_STATS_PATH, "utf-8");
    return JSON.parse(raw).stats ?? {};
  } catch {
    return {};
  }
}

// Tries API-Football first (more precise, structured data), falling back to
// ESPN whenever API-Football can't serve this particular match - no
// matching fixture, stats not published yet there, or (the common case for
// anything more than a day or two old) its free-plan date-window
// restriction rejects the lookup outright. Returns null if neither source
// has it yet.
async function fetchStatsForMatch(match, apiFootballAvailable) {
  const label = `${match.homeTeam.shortName} v ${match.awayTeam.shortName}`;

  if (apiFootballAvailable) {
    try {
      const fixtureId = await findApiFootballFixtureId(match);
      if (!fixtureId) {
        console.log(`  ${label}: no matching API-Football fixture found for stats`);
      } else {
        const stats = await fetchFixtureStatistics(fixtureId, match);
        if (!stats) {
          console.log(`  ${label}: stats not published yet on API-Football`);
        } else {
          let scorers = [];
          try {
            scorers = await fetchFixtureGoals(fixtureId, match);
          } catch (err) {
            console.error(`  ${label}: could not fetch goal scorers from API-Football: ${err.message}`);
          }
          console.log(`  ${label}: got match stats from API-Football (${scorers.length} goal(s))`);
          return { stats, scorers };
        }
      }
    } catch (err) {
      console.log(`  ${label}: API-Football stats fetch failed (${err.message}) - trying ESPN...`);
    }
  }

  try {
    const espnData = await fetchEspnMatchData(match);
    if (espnData) {
      console.log(`  ${label}: got match stats from ESPN (${espnData.scorers.length} goal(s))`);
      return espnData;
    }
  } catch (err) {
    console.error(`  ${label}: ESPN fallback failed: ${err.message}`);
  }

  console.log(`  ${label}: stats not available from any source`);
  return null;
}

// A finished match's stats never change, so this only ever needs to fetch
// each match once - cached permanently once found. Gracefully degrading
// like every other integration in this project: a per-match failure just
// leaves that match without a stats breakdown rather than breaking the
// run. `force` re-fetches even an already-cached match - only used by the
// manual backfill path, to retry or enrich (e.g. after adding a new field)
// a match already on file.
async function fetchMatchStatsFor(finishedMatches, { force = false } = {}) {
  if (finishedMatches.length === 0) return;

  const existingStats = await loadExistingMatchStats();
  const needed = force ? finishedMatches : finishedMatches.filter((m) => !existingStats[m.id]);
  if (needed.length === 0) return;

  // Worst case per match: 1 call to resolve the fixture id + 1 for its
  // statistics + 1 for its goal events. Quota exhaustion only rules out the
  // API-Football attempt below - the ESPN fallback needs no key or quota.
  const apiFootballAvailable =
    Boolean(API_FOOTBALL_KEY) && (await hasApiFootballQuotaFor(needed.length * 3));

  for (const match of needed) {
    const result = await fetchStatsForMatch(match, apiFootballAvailable);
    if (!result) continue;
    existingStats[match.id] = {
      utcDate: match.utcDate,
      homeTeamId: match.homeTeam.id,
      awayTeamId: match.awayTeam.id,
      stats: result.stats,
      scorers: result.scorers,
    };
  }

  await mkdir(path.dirname(MATCH_STATS_PATH), { recursive: true });
  await writeFile(
    MATCH_STATS_PATH,
    JSON.stringify({ fetchedAt: new Date().toISOString(), stats: existingStats }, null, 2) + "\n",
  );
  console.log(`Wrote ${MATCH_STATS_PATH}`);
}

async function loadExistingLive() {
  try {
    const raw = await readFile(OUT_PATH, "utf-8");
    return JSON.parse(raw).matches ?? {};
  } catch {
    return {};
  }
}

function mapLiveMatch(match) {
  return {
    status: match.status,
    utcDate: match.utcDate,
    homeTeamId: match.homeTeam?.id ?? null,
    awayTeamId: match.awayTeam?.id ?? null,
    score: {
      home: match.score?.fullTime?.home ?? null,
      away: match.score?.fullTime?.away ?? null,
    },
  };
}

async function writeLive(matches) {
  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify({ fetchedAt: new Date().toISOString(), matches }, null, 2) + "\n",
  );
}

// data.json's lastResults only keeps the 5 most recent matches, so a match
// from an earlier round (like a retry/backfill target) can easily have
// scrolled out of it by the time someone asks to re-fetch it. Fall back to
// its own already-cached match-stats.json entry - which already recorded
// homeTeamId/awayTeamId/utcDate - and look up full team objects (name,
// shortName, needed for teamsLikelyMatch) from data.standings, which always
// lists every team regardless of recent results.
async function findMatchForBackfill(matchId, data) {
  const fromLastResults = (data.lastResults ?? []).find((m) => String(m.id) === matchId);
  if (fromLastResults) return fromLastResults;

  const cached = (await loadExistingMatchStats())[matchId];
  if (!cached) return null;

  const teamsById = Object.fromEntries((data.standings ?? []).map((row) => [row.team.id, row.team]));
  const homeTeam = teamsById[cached.homeTeamId];
  const awayTeam = teamsById[cached.awayTeamId];
  if (!homeTeam || !awayTeam) return null;

  return { id: Number(matchId), utcDate: cached.utcDate, homeTeam, awayTeam };
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, "utf-8"));

  if (MATCH_STATS_BACKFILL_ID) {
    const match = await findMatchForBackfill(MATCH_STATS_BACKFILL_ID, data);
    if (!match) {
      console.log(
        `Backfill requested for match ${MATCH_STATS_BACKFILL_ID}, but it's not in lastResults or match-stats.json.`,
      );
      return;
    }
    console.log(`Manual stats backfill for ${match.homeTeam.shortName} v ${match.awayTeam.shortName}...`);
    await fetchMatchStatsFor([match], { force: true });
    return;
  }

  const now = Date.now();

  // A match that's gone IN_PLAY still sits in nextFixtures/lastResults
  // exactly as it was at the last weekly fetch.mjs run (neither list gets
  // live-refiltered), so check both for anything whose kickoff falls in
  // our polling window.
  const candidates = [...(data.nextFixtures ?? []), ...(data.lastResults ?? [])];
  const inWindow = candidates.filter((m) => {
    const kickoff = new Date(m.utcDate).getTime();
    return now - kickoff >= -LOOKAHEAD_MS && now - kickoff <= MAX_MATCH_WINDOW_MS;
  });

  const existing = await loadExistingLive();

  if (inWindow.length === 0) {
    console.log("No matches in their kickoff window - skipping football-data.org call.");
    if (Object.keys(existing).length > 0) {
      // Nothing should still be live - clear stale entries so old scores
      // don't linger on the dashboard, and refresh the result/table/fixture
      // data now that whatever was live has definitely finished.
      const finishedIds = Object.keys(existing);
      console.log(
        `${finishedIds.length} match(es) fell out of their live window - refreshing standings/results/fixtures...`,
      );
      const lastResults = await refreshCoreData();
      await fetchMatchStatsFor(lastResults.filter((m) => finishedIds.includes(String(m.id))));
      await writeLive({});
    }
    return;
  }

  console.log(`${inWindow.length} match(es) in their kickoff window - checking live status...`);

  const response = await footballDataRequest("/competitions/PL/matches?status=IN_PLAY,PAUSED");
  const liveMatches = response.matches ?? [];

  const matches = {};
  for (const match of liveMatches) {
    matches[match.id] = mapLiveMatch(match);
  }

  if (liveMatches.length > 0) {
    console.log(
      `Live: ${liveMatches
        .map((m) => `${m.homeTeam?.shortName} ${m.score?.fullTime?.home ?? "-"}-${m.score?.fullTime?.away ?? "-"} ${m.awayTeam?.shortName} (${m.status})`)
        .join(", ")}`,
    );
  } else {
    console.log("No matches currently IN_PLAY/PAUSED.");
  }

  // Anything that was live last run but isn't in this run's live query has
  // finished (or, rarely, been postponed/abandoned) - either way the result/
  // table/fixture list is now stale and needs a refresh.
  const justFinished = Object.keys(existing).filter((id) => !matches[id]);
  if (justFinished.length > 0) {
    console.log(`${justFinished.length} match(es) no longer live - refreshing standings/results/fixtures...`);
    const lastResults = await refreshCoreData();
    await fetchMatchStatsFor(lastResults.filter((m) => justFinished.includes(String(m.id))));
  }

  await writeLive(matches);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
