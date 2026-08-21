#!/usr/bin/env node
// Pulls PL standings/results/fixtures from football-data.org v4 and football
// headlines from BBC Sport + Guardian RSS, then writes public/data.json.
//
// Requires FOOTBALL_DATA_TOKEN in the environment (see .env.example).

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
  apiFootballRequestThrottled,
  findApiFootballTeamId,
  hasApiFootballQuotaFor,
} from "./lib/api-football.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "data.json");
const LINEUPS_PATH = path.join(__dirname, "..", "public", "lineups.json");
// Our team id -> API-Football team id. Team identity never changes, so once
// resolved this never needs a fresh /teams?search= call again - only the
// /coachs lookup itself needs to re-run each time for freshness.
const TEAM_ID_CACHE_PATH = path.join(__dirname, "..", "public", "api-football-team-ids.json");

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FOOTBALL_DATA_TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN env var. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// Optional: football-data.org's coach field is frequently stale, so when
// this is set we look the current manager up on API-Football instead.
// Squads still work fine without it.
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

const RSS_FEEDS = [
  { source: "BBC Sport", url: "http://feeds.bbci.co.uk/sport/football/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/football/rss" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Free tier allows 10 requests/minute; space calls out to stay under that.
const RATE_LIMIT_DELAY_MS = 6500;

async function footballDataRequestThrottled(endpoint) {
  const data = await footballDataRequest(endpoint);
  await sleep(RATE_LIMIT_DELAY_MS);
  return data;
}

// /coachs?team= returns every coach with a career entry at that team, not
// just the current one (confirmed live - Arsenal came back with Ljungberg,
// a 2019 caretaker, ahead of the actual current manager). Pick the one whose
// career entry for this team has no end date; fall back to the first result
// if none look current rather than returning nothing.
async function fetchCurrentCoach(apiFootballTeamId) {
  const coaches = await apiFootballRequestThrottled(`/coachs?team=${apiFootballTeamId}`);
  console.log(
    `  team ${apiFootballTeamId}: /coachs candidates [${coaches.map((c) => c.name).join(", ")}]`,
  );
  const current = coaches.find((coach) =>
    (coach.career ?? []).some((c) => c.team?.id === apiFootballTeamId && !c.end),
  );
  return current?.name ?? coaches[0]?.name ?? null;
}

const POSITION_ORDER = ["Goalkeeper", "Defence", "Midfield", "Offence"];

async function fetchTeamWithRetry(teamId, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await footballDataRequestThrottled(`/teams/${teamId}`);
    } catch (err) {
      if (attempt === attempts) throw err;
      console.error(`  retrying team ${teamId} after error: ${err.message}`);
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }
}

async function loadTeamIdCache() {
  try {
    return JSON.parse(await readFile(TEAM_ID_CACHE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

// fetch-lineups.mjs already pulls each side's coach straight from the
// official match-day team sheet (public/lineups.json), every 15 minutes,
// at zero extra cost to us. That's both free and more current than a fresh
// API-Football team-level lookup, so use it as the first coach source for
// any team that's played (or is about to play) recently.
async function loadConfirmedCoaches() {
  try {
    const { lineups } = JSON.parse(await readFile(LINEUPS_PATH, "utf-8"));
    const latest = {};
    for (const entry of Object.values(lineups ?? {})) {
      for (const [teamId, side] of Object.entries(entry.byTeam ?? {})) {
        if (!side?.coach) continue;
        if (!latest[teamId] || new Date(entry.utcDate) > new Date(latest[teamId].utcDate)) {
          latest[teamId] = { utcDate: entry.utcDate, coach: side.coach };
        }
      }
    }
    return Object.fromEntries(Object.entries(latest).map(([id, v]) => [id, v.coach]));
  } catch {
    return {};
  }
}

async function fetchSquads(standingsTeams) {
  const teams = {};
  const teamIdCache = await loadTeamIdCache();
  const confirmedCoaches = await loadConfirmedCoaches();

  // Worst case per team still needing a lookup: 2 calls to resolve the id
  // (shortName then full-name search) + 1 to fetch its coach. Teams already
  // cached or covered by a confirmed lineup need 0 or 1.
  const needingLookup = standingsTeams.filter((t) => !confirmedCoaches[t.id]);
  const needingResolution = needingLookup.filter((t) => !teamIdCache[t.id]);
  const worstCaseRequests = needingResolution.length * 2 + needingLookup.length;
  const apiFootballAvailable =
    Boolean(API_FOOTBALL_KEY) && (await hasApiFootballQuotaFor(worstCaseRequests));

  let cacheDirty = false;

  for (const ourTeam of standingsTeams) {
    const teamId = ourTeam.id;
    try {
      const data = await fetchTeamWithRetry(teamId);
      const squad = (data.squad ?? [])
        .map((player) => ({
          id: player.id,
          name: player.name,
          position: player.position,
          dateOfBirth: player.dateOfBirth,
          nationality: player.nationality,
        }))
        .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));

      // football-data.org's free tier does sometimes return a coach name,
      // but it's frequently stale (confirmed live - Chelsea, Liverpool and
      // Fulham all came back with managers who left years ago), so it's
      // only used as a last-resort fallback below.
      let coach = confirmedCoaches[teamId] ?? null;
      if (coach) {
        console.log(`  ${ourTeam.name}: using confirmed match-day coach "${coach}" (no API call needed)`);
      } else if (apiFootballAvailable) {
        try {
          const cacheSizeBefore = Object.keys(teamIdCache).length;
          const apiFootballId = await findApiFootballTeamId(ourTeam, teamIdCache);
          if (Object.keys(teamIdCache).length !== cacheSizeBefore) cacheDirty = true;
          if (apiFootballId) coach = await fetchCurrentCoach(apiFootballId);
        } catch (err) {
          console.error(`  could not fetch coach for team ${teamId}: ${err.message}`);
        }
      }
      if (!coach) coach = data.coach?.name ?? null;

      teams[teamId] = { coach, squad };
    } catch (err) {
      console.error(`Failed to fetch squad for team ${teamId}: ${err.message}`);
    }
  }

  if (cacheDirty) {
    await mkdir(path.dirname(TEAM_ID_CACHE_PATH), { recursive: true });
    await writeFile(TEAM_ID_CACHE_PATH, JSON.stringify(teamIdCache, null, 2) + "\n");
    console.log(`Updated ${TEAM_ID_CACHE_PATH}`);
  }

  return teams;
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

// BBC uses a single self-closing <media:thumbnail width="w" url="...">.
// Guardian repeats <media:content width="w" url="..."> at several sizes;
// pick the one closest to a good card-thumbnail width.
function extractImage(xml) {
  const thumbnail = xml.match(/<media:thumbnail[^>]*\surl="([^"]*)"/i);
  if (thumbnail) return decodeXmlEntities(thumbnail[1]);

  const contentMatches = [...xml.matchAll(/<media:content[^>]*\swidth="(\d+)"[^>]*\surl="([^"]*)"/gi)];
  if (contentMatches.length === 0) return null;

  const TARGET_WIDTH = 460;
  contentMatches.sort(
    (a, b) => Math.abs(Number(a[1]) - TARGET_WIDTH) - Math.abs(Number(b[1]) - TARGET_WIDTH),
  );
  return decodeXmlEntities(contentMatches[0][2]);
}

function parseRssItems(xml) {
  const items = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return items.map((item) => ({
    title: extractTag(item, "title"),
    link: extractTag(item, "link"),
    pubDate: extractTag(item, "pubDate"),
    image: extractImage(item),
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

// Tags each headline with the PL teams mentioned in its title, so the UI
// can offer a "filter by team" control without a dedicated news API.
function tagHeadlineTeams(headlines, standings) {
  const teams = standings.map((row) => ({
    id: row.team.id,
    names: [row.team.shortName, row.team.name.replace(/\s*(FC|AFC)$/i, "")],
  }));

  return headlines.map((headline) => {
    const title = headline.title.toLowerCase();
    const teamIds = teams
      .filter(({ names }) => names.some((name) => title.includes(name.toLowerCase())))
      .map(({ id }) => id);
    return { ...headline, teams: teamIds };
  });
}

async function main() {
  console.log("Fetching PL standings, results, fixtures, and headlines...");

  const [standings, lastResults, nextFixtures, headlines] = await Promise.all([
    fetchStandings(),
    fetchLastResults(5),
    fetchNextFixtures(10),
    fetchHeadlines(),
  ]);

  console.log(`Fetching squads for ${standings.length} teams (rate-limited, this takes a while)...`);
  const teams = await fetchSquads(standings.map((row) => row.team));

  const data = {
    fetchedAt: new Date().toISOString(),
    standings,
    lastResults,
    nextFixtures,
    headlines: tagHeadlineTeams(headlines, standings),
    teams,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + "\n");

  console.log(`Wrote ${OUT_PATH}`);
  console.log(
    `  standings: ${standings.length}, lastResults: ${lastResults.length}, ` +
      `nextFixtures: ${nextFixtures.length}, headlines: ${headlines.length}, ` +
      `teams: ${Object.keys(teams).length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
