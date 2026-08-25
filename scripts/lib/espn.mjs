// Shared client for ESPN's public but unofficial/undocumented site API -
// no key, no signup, but can change shape or disappear without notice.
// Used by fetch-lineups.mjs (as a lineup cross-check) and
// fetch-live-scores.mjs (as a fallback stats/scorers source for matches too
// old for API-Football's free-plan date window).

import { teamsLikelyMatch } from "./api-football.mjs";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1";

export async function espnRequest(path) {
  const res = await fetch(`${ESPN_BASE}${path}`);
  if (!res.ok) throw new Error(`ESPN ${path} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function findEspnEventId(ourMatch) {
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
