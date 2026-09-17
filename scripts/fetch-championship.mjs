#!/usr/bin/env node
// Fetches EFL Championship standings, upcoming fixtures, and recent results
// from football-data.org - the same free-tier API and token already used
// for the Premier League/Champions League data. The Championship (code
// "ELC") is the only English Football League competition on this free
// plan - confirmed live via /v4/competitions, which lists ELC alongside
// PL/CL but no League One/League Two equivalent - so "EFL data" here means
// the Championship specifically, not the full EFL pyramid.
//
// Deliberately scoped down for this first pass, same as the Champions
// League pipeline: no squads, lineups, match stats, odds, or live-score
// tracking - just enough for a read-only Championship option in the
// Standings/Fixtures/Results tabs. Those can be layered on later the same
// way they were for the Premier League tabs, if wanted.
//
// Requires FOOTBALL_DATA_TOKEN in the environment.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  fetchStandings,
  fetchLastResults,
  fetchNextFixtures,
  ALL_MATCHES,
} from "./lib/football-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "championship.json");

const COMPETITION = "ELC";

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FOOTBALL_DATA_TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN env var.");
  process.exit(1);
}

async function main() {
  console.log("Fetching Championship standings, results, and fixtures...");

  let standings, lastResults, nextFixtures;
  try {
    [standings, lastResults, nextFixtures] = await Promise.all([
      fetchStandings(COMPETITION),
      fetchLastResults(ALL_MATCHES, COMPETITION),
      fetchNextFixtures(ALL_MATCHES, COMPETITION),
    ]);
  } catch (err) {
    console.error(`Could not fetch Championship data: ${err.message}`);
    console.log("Leaving public/championship.json untouched.");
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
