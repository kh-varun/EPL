#!/usr/bin/env node
// Fetches LIVE scores for any Premier League match currently in progress,
// so the dashboard can show up-to-date scores while a game is being
// played. Designed to run every ~10 minutes via a scheduled workflow, and
// does nothing - zero API calls - unless some match's kickoff window
// overlaps right now.
//
// Requires FOOTBALL_DATA_TOKEN in the environment.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "public", "data.json");
const OUT_PATH = path.join(__dirname, "..", "public", "live-scores.json");

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FOOTBALL_DATA_TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN env var.");
  process.exit(1);
}

const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

// Start checking a bit before the scheduled kickoff (matches sometimes go
// IN_PLAY a few minutes early) and keep checking for a few hours after in
// case of delays - stoppage time, weather, whatever. Once the match is
// actually FINISHED it drops out of the IN_PLAY/PAUSED query on its own.
const LOOKAHEAD_MS = 15 * 60 * 1000;
const MAX_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;

async function footballDataRequest(endpoint) {
  const res = await fetch(`${FOOTBALL_DATA_BASE}${endpoint}`, {
    headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org ${endpoint} failed: ${res.status} ${res.statusText} ${body}`);
  }
  return res.json();
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

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, "utf-8"));
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
      // don't linger on the dashboard.
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

  await writeLive(matches);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
