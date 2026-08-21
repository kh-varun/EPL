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

export async function fetchNextFixtures(limit = 10) {
  const data = await footballDataRequest("/competitions/PL/matches?status=SCHEDULED");
  const matches = [...(data.matches ?? [])].sort(
    (a, b) => new Date(a.utcDate) - new Date(b.utcDate),
  );
  return matches.slice(0, limit).map(mapMatch);
}
