// Shared client for ESPN's public but unofficial/undocumented site API -
// no key, no signup, but can change shape or disappear without notice.
// Used by fetch-lineups.mjs (as a lineup cross-check), fetch-live-scores.mjs
// (as a fallback stats/scorers source for matches too old for API-Football's
// free-plan date window), and fetch.mjs/fetch-live-scores.mjs (to resolve a
// US broadcaster/streaming name for upcoming fixtures).

import { teamsLikelyMatch } from "./api-football.mjs";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1";

export async function espnRequest(path) {
  const res = await fetch(`${ESPN_BASE}${path}`);
  if (!res.ok) throw new Error(`ESPN ${path} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// A day's scoreboard is fetched at most once per process, however many of
// our fixtures fall on it - callers doing this per-fixture (fetch.mjs
// resolving broadcasters for ~10 upcoming fixtures, several of which
// usually share a matchday) would otherwise refetch the same date
// repeatedly.
const scoreboardCache = new Map();

function getScoreboard(dateStr) {
  if (!scoreboardCache.has(dateStr)) {
    scoreboardCache.set(dateStr, espnRequest(`/scoreboard?dates=${dateStr}`));
  }
  return scoreboardCache.get(dateStr);
}

async function findEspnEvent(ourMatch) {
  const date = ourMatch.utcDate.slice(0, 10).replace(/-/g, "");
  const data = await getScoreboard(date);
  return (
    (data.events ?? []).find((e) => {
      const competitors = e.competitions?.[0]?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      return (
        home &&
        away &&
        teamsLikelyMatch(ourMatch.homeTeam, home.team?.displayName ?? "") &&
        teamsLikelyMatch(ourMatch.awayTeam, away.team?.displayName ?? "")
      );
    }) ?? null
  );
}

export async function findEspnEventId(ourMatch) {
  const event = await findEspnEvent(ourMatch);
  return event?.id ?? null;
}

// Best-effort read of ESPN's broadcaster info for a fixture - unconfirmed
// against real docs, same as every other ESPN-derived field in this project.
// geoBroadcasts (typed by region/lang, e.g. Peacock/NBC/USA Network for US
// viewers) is tried first since it's the more specific field on other ESPN
// sports APIs; broadcasts (a flatter names[] list) is the fallback. Dumps
// the raw shape when an event is found but neither field yields a name, per
// this repo's ship-logging-first convention for unverified integrations.
function extractBroadcastName(event, label) {
  const comp = event.competitions?.[0];
  const geo = comp?.geoBroadcasts ?? [];
  const usGeo = geo.find((g) => g.region === "US" || g.lang === "en") ?? geo[0];
  if (usGeo?.media?.shortName) return usGeo.media.shortName;

  const broadcasts = comp?.broadcasts ?? [];
  if (broadcasts[0]?.names?.[0]) return broadcasts[0].names[0];

  if (geo.length > 0 || broadcasts.length > 0) {
    console.log(
      `    ESPN: found broadcast data for ${label} but couldn't extract a name - ` +
        `raw geoBroadcasts/broadcasts: ${JSON.stringify({ geoBroadcasts: geo, broadcasts })}`,
    );
  }
  return null;
}

export async function findEspnBroadcast(ourMatch) {
  const label = `${ourMatch.homeTeam.shortName} v ${ourMatch.awayTeam.shortName}`;
  const event = await findEspnEvent(ourMatch);
  if (!event) return null;
  return extractBroadcastName(event, label);
}

// Attaches a `broadcast` field (a US TV/streaming name like "Peacock", or
// null when none was found) to each match - shared by fetch.mjs and
// fetch-live-scores.mjs so both scripts shape nextFixtures identically. A
// per-match failure never fails the run; it just leaves that match's
// broadcast as null.
export async function attachBroadcasts(matches) {
  const withBroadcasts = [];
  for (const match of matches) {
    let broadcast = null;
    try {
      broadcast = await findEspnBroadcast(match);
    } catch (err) {
      console.log(
        `  ${match.homeTeam.shortName} v ${match.awayTeam.shortName}: broadcast lookup failed (${err.message})`,
      );
    }
    withBroadcasts.push({ ...match, broadcast });
  }
  return withBroadcasts;
}
