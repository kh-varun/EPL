// Shared API-Football v3 client + team/fixture name-matching helpers. Used
// by fetch.mjs (manager names), fetch-lineups.mjs (confirmed lineups), and
// fetch-live-scores.mjs (match statistics for just-finished matches), so the
// three scripts can't drift on how a team name gets resolved or a fixture
// gets matched to ours.

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

export async function apiFootballRequest(endpoint) {
  const res = await fetch(`${API_FOOTBALL_BASE}${endpoint}`, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (body.errors && Object.keys(body.errors).length > 0) {
    throw new Error(`API-Football ${endpoint} returned errors: ${JSON.stringify(body.errors)}`);
  }
  return body.response ?? [];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Free tier allows 10 requests/minute; space calls out to stay under that.
export const RATE_LIMIT_DELAY_MS = 6500;

export async function apiFootballRequestThrottled(endpoint) {
  const data = await apiFootballRequest(endpoint);
  await sleep(RATE_LIMIT_DELAY_MS);
  return data;
}

export function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/\bfc\b|\bafc\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Clubs whose common short name doesn't share a word with the name
// API-Football uses, so substring matching alone can't connect them.
export const NAME_ALIASES = {
  wolverhampton: ["wolves"],
  "wolverhampton wanderers": ["wolves"],
};

// Word-boundary match, not raw substring - a plain `includes()` check matched
// "Man City" against "Techiman City" and "Man United" against "Cwmamman
// United FC" (confirmed live), since "man city"/"man united" are literal
// substrings of those unrelated clubs' names once you cross a word boundary.
//
// Checked in both directions - API-Football's own name is sometimes shorter
// than ours (confirmed live: their name for Brighton & Hove Albion is
// apparently just "Brighton", so requiring all of *our* words in *theirs*
// never matched; requiring all of *theirs* in *ours* catches this case too).
export function teamsLikelyMatch(ourTeam, theirName) {
  const ours = [normalizeTeamName(ourTeam.name), normalizeTeamName(ourTeam.shortName)];
  const withAliases = ours.flatMap((name) => [name, ...(NAME_ALIASES[name] ?? [])]);
  const theirWords = normalizeTeamName(theirName).split(" ").filter(Boolean);
  const theirSet = new Set(theirWords);
  return withAliases.some((name) => {
    const ourWords = name.split(" ").filter(Boolean);
    if (ourWords.length === 0 || theirWords.length === 0) return false;
    const ourSet = new Set(ourWords);
    return ourWords.every((w) => theirSet.has(w)) || theirWords.every((w) => ourSet.has(w));
  });
}

// A query string suitable for API-Football's own search: no "FC"/"AFC"
// suffix (confirmed live - searching "Manchester City FC" or "Manchester
// United FC" returns zero results, since API-Football's own name for both
// is just "Manchester City"/"Manchester United" and their search wants a
// literal substring of it) and no punctuation (confirmed live - searching
// "Brighton & Hove Albion FC" fails outright with "The Search field may
// only contain alpha-numeric characters and spaces").
export function searchableTeamName(name) {
  return name
    .replace(/\bfc\b|\bafc\b/gi, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Resolves our team to its API-Football id via a name search rather than
// /teams?league=&season=, which the free plan restricts to a handful of
// past seasons ("Free plans do not have access to this season, try from
// 2022 to 2024" - confirmed against the live API) and would silently miss
// this season's newly promoted clubs even for an allowed year. A team's
// identity doesn't change season to season, so a plain name search sidesteps
// the restriction entirely and covers every club, promoted or not.
//
// Tries shortName, then the full name, then just the shortName's first word
// - API-Football's search seems to do its own raw substring match
// server-side, so a two-word shortName like "Man City"/"Man United" returns
// nothing useful (it isn't a literal substring of "Manchester City"/
// "Manchester United") and needs the fuller name to surface the real club.
// Brighton needs the third, narrower attempt: even the sanitized full name
// ("Brighton Hove Albion") isn't a literal substring of whatever punctuated
// form API-Football stores their name in (confirmed live - both the
// shortName and full-name searches return zero results) - a single word
// is far more likely to appear literally inside their name no matter how
// it's punctuated, and teamsLikelyMatch still verifies the actual match
// afterward so a too-broad query can't cause a wrong pick.
//
// `cache` maps our team id -> API-Football id and is checked first so a
// resolved team never needs this search again.
export async function findApiFootballTeamId(ourTeam, cache) {
  if (cache[ourTeam.id]) return cache[ourTeam.id];

  const searchTerms = [
    ...new Set([
      searchableTeamName(ourTeam.shortName),
      searchableTeamName(ourTeam.name),
      searchableTeamName(ourTeam.shortName).split(" ")[0],
    ]),
  ].filter(Boolean);
  for (const term of searchTerms) {
    try {
      const results = await apiFootballRequestThrottled(`/teams?search=${encodeURIComponent(term)}`);
      const match = results.find(({ team }) => teamsLikelyMatch(ourTeam, team.name));
      console.log(
        `  ${ourTeam.name}: search "${term}" candidates [${results.map((r) => r.team.name).join(", ")}] -> matched "${match?.team.name ?? "none"}" (id ${match?.team.id ?? "n/a"})`,
      );
      if (match) {
        cache[ourTeam.id] = match.team.id;
        return match.team.id;
      }
    } catch (err) {
      console.error(`  could not resolve API-Football id for ${ourTeam.name}: ${err.message}`);
      return null;
    }
  }
  return null;
}

// Deliberately NOT passing league/season - confirmed live that /fixtures
// with season=2026 hits the exact same free-plan restriction already
// documented for /teams?league=&season= ("Free plans do not have access to
// this season, try from 2022 to 2024"), which meant this endpoint failed on
// every single run until fixed. Querying by date alone returns every
// fixture worldwide that day, but teamsLikelyMatch below still filters down
// to the real match, so the extra volume doesn't cost correctness - only a
// slightly bigger response to fetch and filter.
export async function findApiFootballFixtureId(ourMatch) {
  const date = ourMatch.utcDate.slice(0, 10); // YYYY-MM-DD
  const fixtures = await apiFootballRequest(`/fixtures?date=${date}`);

  const match = fixtures.find(
    (f) =>
      teamsLikelyMatch(ourMatch.homeTeam, f.teams?.home?.name ?? "") &&
      teamsLikelyMatch(ourMatch.awayTeam, f.teams?.away?.name ?? ""),
  );

  return match?.fixture?.id ?? null;
}

// One /status call up front tells us how much of today's shared 100 req/day
// budget is left (lineups.yml polls the same key every 15 min). Skip a
// lookup pass outright if there isn't enough left for it, rather than
// burning the remaining requests (and their 6.5s throttle delays) on calls
// that are guaranteed to fail partway through anyway.
export async function hasApiFootballQuotaFor(requestsNeeded) {
  if (requestsNeeded === 0) return true;
  try {
    const status = await apiFootballRequestThrottled("/status");
    const used = status?.requests?.current;
    const limit = status?.requests?.limit_day;
    if (typeof used !== "number" || typeof limit !== "number") return true;
    const remaining = limit - used;
    console.log(`API-Football quota: ${used}/${limit} used today, ${remaining} remaining.`);
    if (remaining < requestsNeeded) {
      console.log(`  only ${remaining} left but up to ${requestsNeeded} could be needed - skipping.`);
      return false;
    }
    return true;
  } catch (err) {
    // The /status call itself counts against the quota, so if it fails with
    // this exact message the quota is definitely exhausted (confirmed live)
    // - fail closed rather than proceeding into more calls that are all
    // guaranteed to fail the same way. Any other error is unknown/transient,
    // so fail open and let individual calls succeed or degrade as normal.
    const exhausted = /reached the request limit for the day/i.test(err.message);
    console.error(`  could not check API-Football quota: ${err.message}`);
    if (exhausted) {
      console.log("  quota is exhausted for today - skipping this lookup pass.");
    }
    return !exhausted;
  }
}
