#!/usr/bin/env node
// Fetches UEFA Champions League standings, upcoming fixtures, and recent
// results from football-data.org - the same free-tier API and token
// already used for the Premier League data (CL is one of the competitions
// covered by the free plan, no new credential needed).
//
// Deliberately scoped down from the EPL pipeline for this first pass: no
// squads, lineups, match stats, odds, or live-score tracking - just enough
// for a read-only Champions League tab. Those can be layered on later the
// same way they were for the EPL tabs, if wanted.
//
// Requires FOOTBALL_DATA_TOKEN in the environment.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  fetchStandings,
  fetchLastResults,
  fetchNextFixtures,
  ALL_RESULTS,
} from "./lib/football-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "champions-league.json");

const COMPETITION = "CL";

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FOOTBALL_DATA_TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN env var.");
  process.exit(1);
}

async function main() {
  console.log("Fetching Champions League standings, results, and fixtures...");

  let standings, lastResults, nextFixtures;
  try {
    [standings, lastResults, nextFixtures] = await Promise.all([
      fetchStandings(COMPETITION),
      fetchLastResults(ALL_RESULTS, COMPETITION),
      fetchNextFixtures(10, COMPETITION),
    ]);
  } catch (err) {
    console.error(`Could not fetch Champions League data: ${err.message}`);
    console.log("Leaving public/champions-league.json untouched.");
    return;
  }

  const data = { fetchedAt: new Date().toISOString(), standings, lastResults, nextFixtures };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `Wrote ${OUT_PATH}: standings ${standings.length}, lastResults ${lastResults.length}, ` +
      `nextFixtures ${nextFixtures.length}`,
  );
}

// Guarded so tests (or any future consumer) can import this module without
// triggering a live fetch + file write as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
