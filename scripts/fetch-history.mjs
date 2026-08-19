#!/usr/bin/env node
// Builds public/history.json with LAST SEASON's data:
//
//   - Each team's final league position and record, from football-data.org.
//     Verified working on the free tier.
//   - Each player's season stats (appearances, goals, assists, ...), from
//     API-Football. Best-effort: API-Football's free plan restricts how far
//     back you can query, so this may legitimately come back empty. Team
//     history is written regardless so one failure can't take out the other.
//
// Last season's numbers never change, so this only needs re-running when the
// season rolls over - it is NOT part of the frequent update jobs.
//
// Requires FOOTBALL_DATA_TOKEN. API_FOOTBALL_KEY is optional; without it the
// player half is skipped cleanly.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "history.json");

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FOOTBALL_DATA_TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN env var.");
  process.exit(1);
}
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const PL_LEAGUE_ID = 39;

// Season is identified by its starting year in both APIs: 2025 => 2025-26.
const SEASON = Number(process.env.HISTORY_SEASON ?? new Date().getUTCFullYear() - 1);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function footballDataRequest(endpoint) {
  const res = await fetch(`${FOOTBALL_DATA_BASE}${endpoint}`, {
    headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN },
  });
  if (!res.ok) {
    throw new Error(`football-data.org ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function apiFootballRequest(endpoint) {
  const res = await fetch(`${API_FOOTBALL_BASE}${endpoint}`, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`API-Football ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  // API-Football reports plan/auth problems in a 200 body rather than a status
  // code, so surface those explicitly instead of silently returning nothing.
  if (body?.errors && !Array.isArray(body.errors) && Object.keys(body.errors).length > 0) {
    throw new Error(`API-Football ${endpoint}: ${JSON.stringify(body.errors)}`);
  }
  return body;
}

async function fetchTeamHistory() {
  const data = await footballDataRequest(`/competitions/PL/standings?season=${SEASON}`);
  const table = data.standings?.find((s) => s.type === "TOTAL")?.table ?? [];

  const teams = {};
  for (const row of table) {
    teams[row.team.id] = {
      position: row.position,
      playedGames: row.playedGames,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points,
    };
  }

  return {
    seasonLabel: `${SEASON}-${String(SEASON + 1).slice(2)}`,
    totalTeams: table.length,
    teams,
  };
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents so "Guehi" matches "Guéhi"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapPlayerStats(entry) {
  // A player can have several stat blocks (cups, Europe); keep the league one.
  const leagueStats =
    entry.statistics?.find((s) => s.league?.id === PL_LEAGUE_ID) ?? entry.statistics?.[0];
  if (!leagueStats) return null;

  const appearances = leagueStats.games?.appearences ?? 0;
  if (!appearances) return null; // never played - nothing worth showing

  return {
    name: entry.player?.name ?? null,
    photo: entry.player?.photo ?? null,
    appearances,
    lineups: leagueStats.games?.lineups ?? 0,
    minutes: leagueStats.games?.minutes ?? 0,
    rating: leagueStats.games?.rating ? Number(leagueStats.games.rating).toFixed(2) : null,
    goals: leagueStats.goals?.total ?? 0,
    assists: leagueStats.goals?.assists ?? 0,
    yellowCards: leagueStats.cards?.yellow ?? 0,
    redCards: leagueStats.cards?.red ?? 0,
  };
}

async function fetchPlayerHistory() {
  if (!API_FOOTBALL_KEY) {
    console.log("No API_FOOTBALL_KEY set - skipping player season stats.");
    return { available: false, reason: "no-api-key", players: {} };
  }

  // One call tells us the plan, and whether the key works at all.
  try {
    const status = await apiFootballRequest("/status");
    const acct = status?.response;
    console.log(
      `API-Football plan: ${acct?.subscription?.plan ?? "?"}, ` +
        `requests today: ${acct?.requests?.current ?? "?"}/${acct?.requests?.limit_day ?? "?"}`,
    );
  } catch (err) {
    console.error(`API-Football status check failed: ${err.message}`);
    return { available: false, reason: err.message, players: {} };
  }

  let teams;
  try {
    const res = await apiFootballRequest(`/teams?league=${PL_LEAGUE_ID}&season=${SEASON}`);
    teams = res?.response ?? [];
  } catch (err) {
    console.error(`Could not list ${SEASON} teams: ${err.message}`);
    return { available: false, reason: err.message, players: {} };
  }

  if (teams.length === 0) {
    // Almost always the free plan refusing an out-of-range season.
    const reason = `API-Football returned no teams for season ${SEASON} (likely outside the free plan's allowed seasons)`;
    console.error(reason);
    return { available: false, reason, players: {} };
  }

  console.log(`Fetching ${SEASON} player stats for ${teams.length} teams...`);
  const players = {};
  let failures = 0;

  for (const { team } of teams) {
    let page = 1;
    let totalPages = 1;

    do {
      try {
        const res = await apiFootballRequest(
          `/players?team=${team.id}&season=${SEASON}&page=${page}`,
        );
        totalPages = res?.paging?.total ?? 1;

        for (const entry of res?.response ?? []) {
          const stats = mapPlayerStats(entry);
          if (!stats?.name) continue;
          players[normalizeName(stats.name)] = stats;
        }
      } catch (err) {
        failures++;
        console.error(`  ${team.name} page ${page}: ${err.message}`);
        break;
      }

      page++;
      await sleep(6500); // free plan allows 10 req/min
    } while (page <= totalPages);
  }

  console.log(`Collected stats for ${Object.keys(players).length} players (${failures} failures)`);
  return { available: Object.keys(players).length > 0, reason: null, players };
}

async function main() {
  console.log(`Building last-season history for ${SEASON}-${String(SEASON + 1).slice(2)}...`);

  const teamHistory = await fetchTeamHistory();
  console.log(`Team history: ${Object.keys(teamHistory.teams).length} teams`);

  const playerHistory = await fetchPlayerHistory();

  const data = {
    fetchedAt: new Date().toISOString(),
    season: SEASON,
    seasonLabel: teamHistory.seasonLabel,
    totalTeams: teamHistory.totalTeams,
    teams: teamHistory.teams,
    playersAvailable: playerHistory.available,
    playersUnavailableReason: playerHistory.reason,
    players: playerHistory.players,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
