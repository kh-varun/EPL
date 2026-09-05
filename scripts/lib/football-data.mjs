// Shared football-data.org v4 client + response mappers. Used by both
// fetch.mjs (the full weekly refresh, which also fetches squads/coaches)
// and fetch-live-scores.mjs (a lightweight standings/results/fixtures
// refresh right after a match finishes), so the two scripts can't drift
// on how a team/match gets shaped into data.json.

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;

const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

export async function footballDataRequest(endpoint) {
  const res = await fetch(`${FOOTBALL_DATA_BASE}${endpoint}`, {
    headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN },
  });
  if (!res.ok) {
    // football-data.org returns 400 (not 401/403) for a bad/malformed token,
    // and its response body explains why - surface it instead of just the
    // status code, or a bad-token misconfiguration looks identical to any
    // other API error in the logs.
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org ${endpoint} failed: ${res.status} ${res.statusText} ${body}`);
  }
  return res.json();
}

export function mapTeam(team) {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    tla: team.tla,
    crest: team.crest,
  };
}

export function mapMatch(match) {
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

export async function fetchStandings() {
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

export async function fetchLastResults(limit = 5) {
  const data = await footballDataRequest("/competitions/PL/matches?status=FINISHED");
  const matches = [...(data.matches ?? [])].sort(
    (a, b) => new Date(b.utcDate) - new Date(a.utcDate),
  );
  return matches.slice(0, limit).map(mapMatch);
}

// A SCHEDULED/TIMED/IN_PLAY/PAUSED match whose kickoff is this far in the
// past is impossible - no real Premier League match is still unstarted or
// still going hours after its kickoff time. Confirmed live: football-data.org
// kept reporting four matches from the previous matchday (kicked off up to
// ~30h earlier) as still SCHEDULED/TIMED well after they'd actually finished
// (independently confirmed via lastResults before they aged out of its
// 5-match window) - a caching quirk on their status-filtered endpoint, not a
// real status. Same magnitude as fetch-live-scores.mjs's STALE_LIVE_ENTRY_MS,
// for the same reason: drop it here rather than let a stale "upcoming"
// fixture linger on the Fixtures tab indefinitely.
const STALE_FIXTURE_MS = 4 * 60 * 60 * 1000;

// Deliberately includes IN_PLAY/PAUSED alongside SCHEDULED - confirmed live
// that omitting them is a real bug, not just an unlikely edge case: any full
// refresh that lands while a match is live (this project's own manual
// workflow_dispatch re-trigger included, not just the Wednesday schedule)
// drops that match from both nextFixtures (no longer SCHEDULED) and
// lastResults (not FINISHED yet) at the same time - App.jsx's withLiveScore
// only overlays live-scores.json onto a match it can already find in one of
// those two lists, so the currently-live match vanishes from the dashboard
// entirely until full time instead of just losing its "next fixture" framing.
export async function fetchNextFixtures(limit = 10) {
  const data = await footballDataRequest("/competitions/PL/matches?status=SCHEDULED,IN_PLAY,PAUSED");
  const now = Date.now();
  const raw = data.matches ?? [];

  // Diagnostic: confirmed live a multi-week gap in this endpoint's response
  // (matches from the next ~7 weeks missing entirely, while further-out ones
  // came back fine) - dump the raw response's date range and status
  // breakdown so a repeat is debuggable from the Actions log instead of a
  // bare "fixtures are wrong" report.
  if (raw.length > 0) {
    const dates = raw.map((m) => m.utcDate).sort();
    const statusCounts = {};
    for (const m of raw) statusCounts[m.status] = (statusCounts[m.status] ?? 0) + 1;
    console.log(
      `  fetchNextFixtures: raw response has ${raw.length} match(es), ` +
        `dates ${dates[0]} to ${dates[dates.length - 1]}, statuses ${JSON.stringify(statusCounts)}`,
    );
  } else {
    console.log("  fetchNextFixtures: raw response had 0 matches for status=SCHEDULED,IN_PLAY,PAUSED");
  }

  const matches = raw
    .filter((m) => now - new Date(m.utcDate).getTime() <= STALE_FIXTURE_MS)
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  return matches.slice(0, limit).map(mapMatch);
}
