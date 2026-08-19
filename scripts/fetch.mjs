#!/usr/bin/env node
// Pulls PL standings/results/fixtures from football-data.org v4 and football
// headlines from BBC Sport + Guardian RSS, then writes public/data.json.
//
// Requires FOOTBALL_DATA_TOKEN in the environment (see .env.example).

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "data.json");

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FOOTBALL_DATA_TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN env var. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

const RSS_FEEDS = [
  { source: "BBC Sport", url: "http://feeds.bbci.co.uk/sport/football/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/football/rss" },
];

async function footballDataRequest(endpoint) {
  const res = await fetch(`${FOOTBALL_DATA_BASE}${endpoint}`, {
    headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN },
  });
  if (!res.ok) {
    throw new Error(`football-data.org ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function mapTeam(team) {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    tla: team.tla,
    crest: team.crest,
  };
}

async function fetchStandings() {
  const data = await footballDataRequest("/competitions/PL/standings");
  const total = data.standings.find((s) => s.type === "TOTAL");
  return (total?.table ?? []).map((row) => ({
    position: row.position,
    team: mapTeam(row.team),
    playedGames: row.playedGames,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    points: row.points,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    form: row.form,
  }));
}

async function fetchLastResults(limit = 5) {
  const data = await footballDataRequest("/competitions/PL/matches?status=FINISHED");
  const matches = [...(data.matches ?? [])].sort(
    (a, b) => new Date(b.utcDate) - new Date(a.utcDate),
  );
  return matches.slice(0, limit).map(mapMatch);
}

async function fetchNextFixtures(limit = 10) {
  const data = await footballDataRequest("/competitions/PL/matches?status=SCHEDULED");
  const matches = [...(data.matches ?? [])].sort(
    (a, b) => new Date(a.utcDate) - new Date(b.utcDate),
  );
  return matches.slice(0, limit).map(mapMatch);
}

function mapMatch(match) {
  return {
    id: match.id,
    utcDate: match.utcDate,
    status: match.status,
    matchday: match.matchday,
    homeTeam: mapTeam(match.homeTeam),
    awayTeam: mapTeam(match.awayTeam),
    score: {
      home: match.score?.fullTime?.home ?? null,
      away: match.score?.fullTime?.away ?? null,
      winner: match.score?.winner ?? null,
    },
  };
}

// --- Minimal RSS parsing (no external deps) ---

function decodeXmlEntities(str) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim();
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXmlEntities(match[1]) : null;
}

function parseRssItems(xml) {
  const items = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return items.map((item) => ({
    title: extractTag(item, "title"),
    link: extractTag(item, "link"),
    pubDate: extractTag(item, "pubDate"),
  }));
}

async function fetchHeadlines() {
  const results = await Promise.all(
    RSS_FEEDS.map(async ({ source, url }) => {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const xml = await res.text();
        return parseRssItems(xml)
          .filter((item) => item.title && item.link)
          .map((item) => ({ ...item, source }));
      } catch (err) {
        console.error(`Failed to fetch headlines from ${source}: ${err.message}`);
        return [];
      }
    }),
  );

  const all = results.flat();

  // Dedupe by normalized title (different outlets often cover the same story).
  const seen = new Set();
  const deduped = [];
  for (const item of all) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => new Date(b.pubDate ?? 0) - new Date(a.pubDate ?? 0));

  return deduped.slice(0, 15);
}

async function main() {
  console.log("Fetching PL standings, results, fixtures, and headlines...");

  const [standings, lastResults, nextFixtures, headlines] = await Promise.all([
    fetchStandings(),
    fetchLastResults(5),
    fetchNextFixtures(10),
    fetchHeadlines(),
  ]);

  const data = {
    fetchedAt: new Date().toISOString(),
    standings,
    lastResults,
    nextFixtures,
    headlines,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + "\n");

  console.log(`Wrote ${OUT_PATH}`);
  console.log(
    `  standings: ${standings.length}, lastResults: ${lastResults.length}, ` +
      `nextFixtures: ${nextFixtures.length}, headlines: ${headlines.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
