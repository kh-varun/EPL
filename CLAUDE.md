# EPL Dashboard

Static Premier League 2026-27 dashboard (Vite + React + Tailwind, dark
theme), deployed to GitHub Pages. Mobile-first. All data comes from free
APIs via scheduled GitHub Actions workflows that commit static JSON into
`public/`; the React app just fetches those files at runtime.

## Data pipeline (`scripts/*.mjs` → workflows)

| Script | Writes | Workflow | Schedule | Needs |
|---|---|---|---|---|
| `fetch.mjs` | `public/data.json`, `public/api-football-team-ids.json` | `update.yml` | Weekly (Wed) | `FOOTBALL_DATA_TOKEN`, `API_FOOTBALL_KEY` (optional, for manager names) |
| `fetch-lineups.mjs` | `public/lineups.json` | `lineups.yml` | Every 15 min | `API_FOOTBALL_KEY`; `HIGHLIGHTLY_API_KEY` optional |
| `fetch-history.mjs` | `public/history.json` | `history.yml` | Monthly | `FOOTBALL_DATA_TOKEN`, `API_FOOTBALL_KEY` (optional) |
| `fetch-odds.mjs` | `public/odds.json` | `odds.yml` | Every 15 min | none (Kalshi is public) |
| `fetch-live-scores.mjs` | `public/live-scores.json`, `public/match-stats.json` | `live-scores.yml` | Every 5 min | `FOOTBALL_DATA_TOKEN`; `API_FOOTBALL_KEY` (optional, for match stats) |

All scripts degrade gracefully: a missing key or a failed call never
crashes the run or corrupts existing JSON — it just leaves that piece of
data as `null`/empty and logs why. Never remove that pattern when editing
these scripts.

`fetch.mjs`'s manager-name lookup is API-Football-call-conscious given the
shared daily quota (see below): `public/api-football-team-ids.json` caches
the resolved team-name → API-Football-id mapping permanently (team identity
never changes, so this search never needs re-running once a team is
resolved), it reuses the coach name `fetch-lineups.mjs` already pulled from
a team's most recent confirmed match-day lineup at zero extra cost before
ever calling API-Football itself, and it checks `/status` up front to skip
the whole manager-lookup pass outright if there isn't enough of today's
quota left, rather than burning it on calls partway through a run that were
always going to fail. Keep all three whenever touching this code - they're
what keeps a routine weekly run to roughly one call per team instead of up
to three.

## Lineup cross-checking

`fetch-lineups.mjs` treats API-Football as the single source of truth for
what gets written to `lineups.json` and shown to users. Two extra sources
run *after* API-Football returns a lineup, purely to log agreement/
disagreement in the Actions log — they never change what ships, so a wrong
or broken secondary source can't corrupt the dashboard:

- **ESPN's site API** (`site.api.espn.com/apis/site/v2/sports/soccer/eng.1`)
  — public, no key, no signup, but unofficial and undocumented. Can change
  shape or disappear without notice; treat any parsing failure here as
  expected, not a bug to chase.
- **Highlightly** (`soccer.highlightly.net`) — a real free tier (100
  req/day, no card), but this integration is **provisional and unverified**:
  its docs site is blocked from the dev sandbox's egress allowlist, so the
  `/matches` and `/lineups/{id}` endpoint paths, the `x-api-key` auth header,
  and the response field names in `findHighlightlyMatchId`/
  `fetchHighlightlyLineup` are all best-effort reads of public search
  results, not confirmed against real docs or a real response. It's
  also completely untestable — even via `workflow_dispatch` — until
  `HIGHLIGHTLY_API_KEY` is actually set, since without a key it just skips.
  The first real run after that key is added needs the full
  ship-logging → trigger → read-log debugging cycle (see below) before
  trusting anything it logs.

## Known API quirks (found the hard way — don't relitigate these)

- **API-Football free plan (this account) blocks `/teams?league=&season=`
  for the current season** — only seasons 2022-2024 are allowed on this
  plan. `/teams?search={name}` is NOT season-gated and works for any
  team/season, since team identity doesn't change year to year — use that
  instead whenever you need to resolve a team name to an API-Football id.
  **The same restriction hits `/fixtures?league=&season=` too** (confirmed
  live, same "Free plans do not have access to this season" error) - this
  meant `fetch-lineups.mjs`'s fixture lookup had been failing on every
  single run since the feature was built, so `lineups.json` had never
  actually held a confirmed lineup in production. `findApiFootballFixtureId`
  now queries `/fixtures?date=` with no league/season at all (returns every
  fixture worldwide that day) and relies on `teamsLikelyMatch` to filter
  down to the real one, same trade-off as the team-search fix above.
- **`/fixtures?date=` is ALSO restricted to a rolling ~3-day window around
  today on this free plan** - a second, separate restriction from the
  season-gate above, confirmed live via the `backfill_match_id` path four
  days after the season opener: `/fixtures?date=2026-08-22` (a Saturday)
  failed on Wednesday the 26th with `"Free plans do not have access to
  this date, try from 2026-08-24 to 2026-08-26"` - i.e. roughly
  yesterday-to-tomorrow, not the fixed 2022-2024 season range. This means
  `findApiFootballFixtureId` - and therefore match stats/scorers - can
  only ever be resolved for a match within about a day of "today", not
  arbitrarily far in the past. Not a problem for the normal, designed-for
  code path (`fetch-live-scores.mjs` resolves the fixture the same day the
  match finishes), but it means `backfill_match_id` can only backfill a
  match from the last day or two - confirmed live when re-backfilling
  Arsenal v Coventry and Hull v Man United (season-opener matches, by then
  4-5 days old) both failed with this exact error, while a 1-day-old match
  succeeded. There is no code fix for this - it would need a paid plan.
- **Last-season (2025-26) player stats are permanently unavailable** on
  this API-Football plan for the same reason — the data itself is outside
  the allowed 2022-2024 range, not a code bug. Would need a paid plan.
  Team-level last-season history is unaffected (different API —
  football-data.org).
- **Kalshi prices are decimal-dollar strings** (`last_price_dollars:
  "0.8400"` = 84%), not the plain-cents integers (`last_price`) their
  docs/examples imply. `last_price` / `yes_bid` / `yes_ask` don't exist on
  the real API response.
- **football-data.org returns 400 (not 401/403) for a bad token**, with
  the real reason in the response body — `footballDataRequest` in
  `fetch.mjs` logs that body, don't strip it back down to just the status
  code.
- **football-data.org's free tier does return a `coach` field, but it's
  often stale** via `/teams/{id}` (confirmed live — it returned Ljungberg
  for Arsenal and Klopp for Liverpool, both long gone). `fetch.mjs` always
  prefers the API-Football lookup when a key is set and only falls back to
  football-data.org's value if that lookup fails.
- **API-Football's `/coachs?team=` returns every coach who's ever had a
  career entry at that team, not just the current one** — `fetchCurrentCoach`
  in `fetch.mjs` picks the entry whose career record for that team has no
  `end` date rather than trusting the first result. Even with that filter,
  **API-Football's own coach data can still be wrong or simply missing the
  real current manager** (confirmed live: Man City's `/coachs` response is
  `[Guardiola]` only, with no Enzo Maresca at all despite Maresca replacing
  him as manager in June 2026; Fulham's `/coachs` response is `[Alvaro
  Arbeloa]` only, and Arbeloa is actually Real Madrid's manager, unrelated
  to Fulham) — a data-quality gap on API-Football's end for those clubs
  specifically, not something fixable in our code.

  **Warning for future sessions, learned the hard way**: don't trust your
  own training-cutoff knowledge of "who manages which club" over what this
  pipeline actually returns. This project's in-story "today" keeps moving
  forward, and a full wave of real Premier League managerial changes
  happened between a typical model's training cutoff and whatever "today"
  is when you're reading this (Chelsea, Man City, Man United, Fulham, and
  Real Madrid all changed manager within the same few months). Earlier the
  same day this was written, a session wrongly concluded Chelsea's "Xabi
  Alonso" and Man United's "Michael Carrick" results were API-Football bugs
  — its assumption that Maresca/Amorim were still in charge was itself the
  stale data; both API-Football results were actually correct. If a
  returned manager name looks surprising, verify with a live web search
  before assuming the API or the code is wrong.
- **API-Football's `/teams?search=` does its own raw substring match
  server-side** — searching "Man City" or "Man United" (the shortNames)
  returns nothing useful because those two-word shortNames aren't literal
  substrings of "Manchester City"/"Manchester United" ("chester" sits in
  between). `findApiFootballTeamId` tries the fuller team name as a second
  search term when the shortName search doesn't produce a match. Relatedly,
  never match team names with plain `includes()` - "man city" is a literal
  substring of "**techi**man city" and "man united" of "cwma**mman**
  united", both real unrelated clubs API-Football returned (confirmed
  live) - `teamsLikelyMatch` requires whole-word overlap instead.
- **The fuller-name search term itself needs sanitizing** (confirmed live)
  - searching "Manchester City FC"/"Manchester United FC" (our full names,
  with the "FC" suffix) returns zero results, because API-Football's own
  name for both is just "Manchester City"/"Manchester United" and its
  substring search wants the query to literally appear in that name -
  the trailing " FC" breaks the match. Separately, searching "Brighton &
  Hove Albion FC" fails outright with `"The Search field may only contain
  alpha-numeric characters and spaces"` - the "&" isn't allowed at all.
  `searchableTeamName` in `fetch.mjs` strips the FC/AFC suffix and any
  non-alphanumeric characters before every search call, not just the
  shortName term.
- **Even the sanitized full name can still return zero results** (confirmed
  live for Brighton: both "Brighton Hove" and "Brighton Hove Albion" search
  as empty). `findApiFootballTeamId` falls back to just the first word of
  the shortName as a third, narrower attempt - and this one actually found
  it: the search for "Brighton" returned the real club. It just wasn't
  picked, because **API-Football's own name for the club is apparently just
  "Brighton"** (confirmed live - the candidate is literally `{name:
  "Brighton"}`, no "Hove"/"Albion" at all), and `teamsLikelyMatch` originally
  only checked that all of *our* words appear in *theirs* - which can never
  pass when their name has fewer words than ours. It now checks both
  directions (all of ours in theirs, OR all of theirs in ours), which fixes
  this without reopening the original false-positive bug (verified: "man
  city"/"man united" still correctly reject "Techiman City"/"Cwmamman
  United FC", since neither direction's subset check passes for those).
- Rate limits: football-data.org free tier is 10 req/min; API-Football
  free tier is 10 req/min / 100 req/day, **shared across every workflow
  using the key** (`lineups.yml` polls every 15 min on the same key) - a
  couple of manual `update.yml` re-triggers in one day is enough to burn
  the rest of the day's quota, after which lookups fail (loudly, with a
  `"reached the request limit for the day"` error) rather than returning
  bad data. Every script throttles with a ~6.5s delay between calls -
  don't remove it, and be aware that adding more per-team API calls
  multiplies total job runtime linearly (~20 teams × Ns delay per call).

## Debugging a workflow you can't test locally

The sandbox this repo is usually developed in blocks most of these API
hosts at the network layer (`external-api.kalshi.com`,
`v3.football.api-sports.io`, `en.wikipedia.org`, `kalshi.com`,
`docs.kalshi.com`, `github.io` have all been confirmed blocked — this is
an egress allowlist thing, not a real outage). `api.football-data.org` is
usually reachable. When you can't reproduce something locally:

1. Ship defensive logging first (dump the raw response on an unexpected
   shape, not just "failed").
2. Trigger the workflow for real via `workflow_dispatch` and read the
   Actions job log — that runner has full network access.
3. Iterate: the diagnostic-logging → real-fix cycle on the Kalshi odds
   integration took 3 small PRs, each informed by the previous run's log,
   and found the actual bug (wrong field names) that no amount of
   re-reading the code would have caught.

## Live scores

`fetch-live-scores.mjs` runs every 5 minutes but only makes a
football-data.org call when some match is worth checking - checked against
the already-cached `nextFixtures`/`lastResults` in `data.json`, at zero API
cost, before ever hitting the network. When something's actually live, it
queries `/matches?status=IN_PLAY,PAUSED` and writes `live-scores.json`
keyed by match id; when nothing is, it clears the file so a finished
match's score doesn't linger with a stale "LIVE" badge (but skips the
write entirely when the file was already empty - the pre-kickoff lookahead
and the post-match tail of the window would otherwise churn `fetchedAt`
into a commit and a full Pages deploy on every poll for no visible
change). `MatchRow` reads `match.liveStatus` (set by `withLiveScore` in
`App.jsx`) to swap in the red "LIVE"/"HT" badge and score pill.

**GitHub's `schedule:` cron is not reliable at this workflow's 5-minute
interval on this repo** - confirmed live via run-history gaps of several
hours between consecutive `live-scores.yml` runs (also seen on `odds.yml`'s
15-minute schedule) - a GitHub-side deprioritization of high-frequency cron
on free-tier/personal repos, not a bug here. `workflow_dispatch` (manual or
via the REST API) still runs immediately, unaffected.

This made an original design assumption wrong, confirmed live: a
`nextFixtures` candidate was only "in window" for a fixed 15-min-before to
3-hours-after span measured from kickoff, on the assumption that some run
would land inside that span. A large enough cron gap can swallow a match's
*entire* window - kickoff, full 90+ minutes, and full time - between two
runs, so the match is never queried even once and the "was live, now
isn't" transition that refreshes `standings`/`lastResults`/`nextFixtures`
never fires. Confirmed live: Chelsea v Brighton (13:00 kickoff) was still
sitting in `nextFixtures` as an upcoming `TIMED` fixture in `data.json` at
17:20 the same day - well past full time - because every run in between
happened to land just outside the old 3-hour cutoff. Fixed by splitting
the two candidate sources: a `nextFixtures` entry whose kickoff has passed
stays a candidate indefinitely (bounded only by a generous
`MAX_PENDING_FIXTURE_AGE_MS` sanity backstop, currently 20h) since checking
it costs nothing extra and it naturally stops being a candidate the moment
`refreshCoreData()` confirms it finished and moves it into `lastResults`;
only `lastResults` entries (already resolved) keep the original fixed
3-hour window, used just to catch the stats-backfill pass shortly after a
just-finished match. Keep this distinction if this logic is touched again
- collapsing it back to one fixed window from "now" reintroduces the bug.

**football-data.org's own `/matches?status=IN_PLAY,PAUSED` filter can
itself return a stale entry** - confirmed live in the same incident:
Tottenham v Newcastle (kicked off the previous day) was still reported as
`PAUSED` with a null score by that endpoint more than 24h after kickoff,
well after the general match-data endpoint already had it as `FINISHED`
0-2. No real Premier League match stays `IN_PLAY`/`PAUSED` anywhere near
that long, so any "live" entry more than `STALE_LIVE_ENTRY_MS` (4h) past
its own kickoff is now dropped rather than written to `live-scores.json` -
this also makes the entry disappear from `existing` on the next run,
which correctly triggers the "no longer live" refresh and self-heals the
file instead of leaving a stale score/status stuck indefinitely.

`App.jsx` keeps an open tab fresh in three layers (its `useEffect` has the
full rationale): `live-scores.json` polled every 60s; an immediate refetch
of `data.json`/`match-stats.json`/`odds.json`/`lineups.json` whenever the
set of live match ids changes - which is exact, not hopeful, because the
workflow run that clears a finished match from `live-scores.json`
refreshes `data.json`/`match-stats.json` in the same commit, so those
files are always deployed alongside the transition the client just
observed; and a 5-minute catch-all refresh of the same files plus a
refresh on `visibilitychange` (a phone that switched apps mid-match).
Only `history.json` is fetched once per page load - it changes monthly.
Without the transition refetch, full time made a match snap back to an
upcoming "VS" fixture (live overlay gone, page-load-time `data.json`
still listing it as SCHEDULED) until a manual reload.

When a match that was previously live drops off the `IN_PLAY`/`PAUSED`
query (or its kickoff window elapses entirely - `data.js`'s own cached
`nextFixtures`/`lastResults` reflect that the transition happened), it's
finished (or, rarely, postponed/abandoned) - either way `data.json`'s
`standings`/`lastResults`/`nextFixtures` are now stale, and would
otherwise stay stale until the next Wednesday `update.yml` run. Rather
than duplicate the standings/fixtures fetch-and-map logic that `fetch.mjs`
already has, both scripts import it from `scripts/lib/football-data.mjs`;
`fetch-live-scores.mjs` calls that shared `fetchStandings`/
`fetchLastResults`/`fetchNextFixtures` itself the moment it detects a
match just finished, so the result and table land within ~5 minutes of
full time instead of waiting up to a week. It deliberately leaves
`teams`/`headlines` untouched (squads and news don't change mid-match) and
does not re-run the expensive per-team squad/coach fetch.

## Match stats dialog

Clicking a finished match on the Results tab opens `MatchStatsDialog`:
goal scorers with the minute scored (under each team's name in the header,
right below the score) and a stats breakdown (shots, shots on target,
possession, passes, pass accuracy, fouls, corners, offsides, cards per
side) - deliberately no embedded highlights video.

Scorers come from a second API-Football call per match, `/fixtures/events`
filtered to `type === "Goal"`, alongside the `/fixtures/statistics` call for
the stats breakdown - so a finished match now costs 3 API-Football calls
total (fixture-id resolve + stats + events) instead of 2, still gated
behind the same `hasApiFootballQuotaFor` pre-check. An own goal or penalty
is annotated inline (`(OG)` / `(pen)`); extra time is rendered as `45+2'`
using API-Football's `time.elapsed`/`time.extra` fields. `fetchMatchStatsFor`
takes an optional `force` flag (used only by the manual backfill path) to
re-fetch an already-cached match - needed to backfill scorers onto matches
that were already fetched before this field existed.

The same moment `fetch-live-scores.mjs` detects a match just went from live
to finished, it also resolves that match's API-Football fixture id (reusing
`findApiFootballFixtureId`, the same date+`teamsLikelyMatch` lookup
`fetch-lineups.mjs` already relies on) and calls
`/fixtures/statistics?fixture=` for both teams' stats, writing the result to
`public/match-stats.json` keyed by our (football-data.org) match id. A
finished match's stats never change, so each match is only ever fetched
once - already-cached matches are skipped on every later run. Gated behind
the same `hasApiFootballQuotaFor` pre-check, and a per-match failure just
leaves that match without a stats breakdown rather than failing the run.

**ESPN fallback**: API-Football's free plan restricts `/fixtures?date=` to
a rolling ~3-day window around today (see the "Known API quirks" entry
below) - fine for the normal same-day path, but it means the manual
`backfill_match_id` retry knob (below) can't reach anything older than a
day or two, confirmed live when re-backfilling the season's first two
matches for scorer data 4-5 days later. `fetchStatsForMatch` now tries
API-Football first (more precise, structured data) and falls back to
ESPN's free public site API - no key, no signup, already used for lineup
cross-checks - whenever API-Football can't serve the match at all: no key
set, quota exhausted, no matching fixture, or that date-window rejection.
`fetchEspnMatchData` in `fetch-live-scores.mjs` reads team stats from
`data.boxscore.teams[].statistics` and goals from `data.keyEvents` via the
same `/summary?event=` ESPN endpoint `fetch-lineups.mjs` already uses for
lineups. The goal-event shape needed two real backfill runs (against
match 560542, Arsenal v Coventry) to pin down, both confirmed live:
`scoringPlay === true` is a reliable goal marker, but the scoring team is
`team.displayName` (ESPN's own numeric `team.id` is in ESPN's id space,
not ours, and will never match `ourMatch.homeTeam/awayTeam.id` - match on
name via `teamsLikelyMatch` instead) and the scorer is
`participants[0].athlete.displayName` (`athletesInvolved`, the first
guess, was never a real field - later `participants` entries are assists).
`clock.displayValue`'s `"N'"`/`"N+M'"` format was a correct guess and
needed no fix. Confirmed end-to-end: match 560542 now carries real scorer
data (Havertz 15', Saka 23', Ødegaard 49'). Team stat key names
(`mapEspnStats` in `fetch-live-scores.mjs`) are still unconfirmed best-effort
guesses, though, since no real match has exercised that path with logging
sharp enough to tell success from a silent wrong-value mapping - if a
`MatchStatsDialog` ever shows suspicious ESPN-sourced stats (all nulls, or
values that don't look like a real match), suspect `mapEspnStats`'s field
names first and re-run the same dump-raw-shape-then-fix cycle used for the
scorers fix. `scripts/lib/espn.mjs` holds the shared `espnRequest`/
`findEspnEventId` client, extracted for the same reason as
`api-football.mjs` - a third consumer (this fallback) of the event-lookup
logic shouldn't mean a third copy of it.

`scripts/lib/api-football.mjs` now holds the API-Football client and all the
team/fixture name-matching helpers (`teamsLikelyMatch`, `searchableTeamName`,
`findApiFootballTeamId`, `findApiFootballFixtureId`,
`hasApiFootballQuotaFor`) shared by `fetch.mjs`, `fetch-lineups.mjs`, and
`fetch-live-scores.mjs` - extracted so a third consumer of the
fixture-lookup logic didn't mean a third copy of it (and a third place to
apply every hard-won matching fix documented above, from the word-boundary
rule through the Brighton bidirectional-matching case).

**Two bugs found shipping this feature, both confirmed live before a real
match ever exercised the code path:**

- `live-scores.yml`'s commit step only ever staged `public/live-scores.json`
  (`git add public/live-scores.json` unconditionally, nothing else) even
  though `refreshCoreData()` and `fetchMatchStatsFor()` in
  `fetch-live-scores.mjs` also write `public/data.json` and
  `public/match-stats.json` - so any changes those two make would be
  silently discarded when the runner terminates, never committed, no error
  raised. Fixed by looping the same conditional `git add` over all three
  files.
- The workflow never passed `API_FOOTBALL_KEY` to the fetch step at all
  (only `FOOTBALL_DATA_TOKEN`), so `fetchMatchStatsFor` would always see it
  as unset and skip - match stats could never have been fetched in
  production regardless of the staging bug above. Fixed by adding
  `API_FOOTBALL_KEY: ${{ secrets.API_FOOTBALL_KEY }}` alongside the existing
  token, same as `lineups.yml`/`update.yml` already do.

Also added a `backfill_match_id` `workflow_dispatch` input (piped through as
`MATCH_STATS_BACKFILL_ID`) that force-fetches stats for one specific match
id, bypassing the normal just-finished-transition detection - needed because
the very first match of the season (Arsenal v Coventry) had already fallen
out of `live-scores.json`'s tracked "was live" state by the time this
feature shipped, so there was no transition left for the normal path to
detect naturally. Useful going forward too, as a retry knob for any match
whose stats fetch failed the first time. `findMatchForBackfill` looks the
id up in `data.lastResults` first, but that list only ever keeps the 5 most
recent matches - confirmed live when backfilling Arsenal v Coventry a
second time (to add scorers) failed with "not in lastResults", since a full
extra round had finished by then and pushed it out of the window. Falls
back to the match's own already-cached `match-stats.json` entry (which
already recorded `homeTeamId`/`awayTeamId`/`utcDate`) plus `data.standings`
for full team objects (name/shortName, needed for `teamsLikelyMatch`) -
`standings` always lists every team regardless of recent results, so this
works for a backfill target of any age.

## Fixture broadcasters (Fixtures tab)

Each upcoming fixture in `data.nextFixtures` carries a `broadcast` field -
the US TV/streaming outlet showing it (e.g. `"Peacock"`), or `null` when
none was found. `MatchRow` highlights a fixture with a known broadcaster
with an orange ring and a "Streaming on {broadcast}" badge instead of the
default white ring - only for upcoming (non-live, unscored) fixtures, so it
never fights with the red live-match ring or a finished-match score pill.

`attachBroadcasts` in `scripts/lib/espn.mjs` resolves this from ESPN's
public site API (already used elsewhere in this project) by looking up
each fixture's date on `/scoreboard?dates=` and matching the team names via
the existing `teamsLikelyMatch` helper, then reading `geoBroadcasts` (tried
first - typed by region/lang, matches other ESPN sports APIs) or the
flatter `broadcasts[].names[]` as a fallback. Like every other ESPN field
in this project, the exact shape is an unconfirmed guess dumped raw to the
log when a match is found but neither field yields a name - the usual
ship-logging-first cycle applies if the log shows that.

Both `fetch.mjs` (the weekly full refresh) and `fetch-live-scores.mjs`'s
`refreshCoreData` (which re-pulls `nextFixtures` the moment a match
finishes) call the same shared `attachBroadcasts`, so the field can't drift
between the two paths the way `nextFixtures` itself already doesn't
(`scripts/lib/football-data.mjs`'s existing rationale). A per-fixture ESPN
lookup failure never fails the run - it just leaves that fixture's
`broadcast` as `null`, same degrade-gracefully pattern as every other
optional field in this pipeline. `findEspnEvent`'s scoreboard fetch is
cached per calendar date within a single run, since several of the ~10
upcoming fixtures usually share a matchday and would otherwise repeat the
same ESPN call.

## All five fetch workflows retry their push

`update.yml`, `lineups.yml`, `odds.yml`, `history.yml`, and
`live-scores.yml` each fetch, commit, and `git push` straight to `main`
independently. Since several of these fire every 10-15 minutes and
`update.yml`'s full squad-fetch loop alone takes several minutes, two of
them landing at once is a real, confirmed-live race - not theoretical:
`update.yml` fetched successfully, committed locally, then got its push
rejected as non-fast-forward because another workflow had pushed to `main`
in the meantime, and the whole run's fetched data was discarded since
there was no retry. Every commit step now does fetch + rebase + push in a
retry loop instead of a single bare `git push` - keep that pattern on any
new scheduled-write workflow added to this repo. Also remember `git diff
--quiet` alone never detects a brand-new untracked file (confirmed to bite
`api-football-team-ids.json` on its first run) - `git add` the output file
conditionally (`if [ -f ... ]`) before diffing, every time, not just when
the file is already known to exist.

The retry-rebase loop only protects against a clean non-fast-forward
rejection - it does **not** make concurrent edits to the *same JSON file*
safe in general. Confirmed live: firing off ~9 `backfill_match_id`
`workflow_dispatch` runs back-to-back to backfill several matches at once
caused two separate failure modes. First, `concurrency: cancel-in-progress:
false` only keeps the run currently executing plus the single
*most-recently-queued* one waiting behind it - GitHub silently cancels
every other already-queued run in between, so most of a rapid-fire batch
never runs at all (7 of 9 in this case). Second, the one straggler that
did run had its own in-memory copy of `match-stats.json` (loaded at
checkout, before the runs ahead of it had pushed their changes) - when its
push was rejected and it rebased onto the newer commit, git's line-based
merge hit a real content conflict inside the JSON (both versions edited
the same `stats` object), the rebase failed outright, and the script's
`set -e` shell killed the job right there - discarding that run's freshly-
fetched data entirely, not just delaying it. `git add`+`git diff --quiet`
protects against losing data to a clean fast-forward race; it does nothing
for two runs that both modify overlapping regions of the same file. Trigger
this kind of manual multi-match backfill one at a time, waiting for each to
land, rather than batching - the normal (non-backfill) path is unaffected
since a single scheduled run already handles every match that finished in
its own 10-minute window in one commit.

## Scheduled-workflow commits never trigger a redeploy on their own

`deploy.yml` builds the site and publishes `dist/` to GitHub Pages. A push
made with the default `GITHUB_TOKEN` - which is how every one of the five
scheduled fetch workflows above commits its data - does **not** fire
another workflow's `on: push` trigger (a deliberate GitHub restriction to
prevent infinite workflow-triggering loops). Confirmed live: every prior
"Deploy to GitHub Pages" run lined up exactly with a PR merge, never with
a `chore: update ...` bot commit - so the live site was silently frozen at
whatever `dist/` was built at the last PR merge, no matter how often the
fetch workflows ran and successfully pushed fresh JSON to `main` in
between. This is almost certainly why the dashboard looked stale earlier
in this project's life (e.g. an out-of-date Arsenal squad) even though
`update.yml` itself was running and succeeding on schedule.

Fixed by adding a `workflow_run` trigger to `deploy.yml` that fires on
completion of each of the five fetch workflows (matched by their `name:`
field, not filename) - `workflow_run` listens for the upstream run's
completion rather than re-triggering off its push, so it isn't subject to
the same `GITHUB_TOKEN` restriction. Keep every new scheduled-write
workflow's `name:` added to that list, or its commits will keep landing on
`main` without ever reaching production.

Most of those completions push nothing, though (a no-match `live-scores.yml`
run alone completes every 5 minutes around the clock), so `deploy.yml` has
a `precheck` job that skips the whole build when the triggering run pushed
nothing: if the run had pushed, `main`'s HEAD would no longer equal the
`workflow_run.head_sha` the run started from; if HEAD still equals it,
the site was already built from this exact commit. The check is
deliberately fail-open - it only applies to `workflow_run` events (push
and `workflow_dispatch` deploys always build) and an empty output builds.
Two invariants to preserve when touching this:

- `concurrency: cancel-in-progress` must stay **false**. With the
  precheck, a no-op run's deploy skips cheaply anyway - but if it instead
  *cancelled* an in-flight build of a real change, that change would never
  deploy, and every later no-op run's precheck would see `main` unchanged
  and keep skipping: the site frozen at old content, the exact failure
  mode described above, reintroduced by the optimization. (Cancelled
  deploy runs from the old `cancel-in-progress: true` era are visible in
  the Actions history - this wasn't hypothetical.)
- The precheck compares against the *triggering run's* start SHA, not the
  last-deployed SHA, so its correctness depends on in-flight deploys never
  being cancelled - which is exactly what the first invariant guarantees.

## Git workflow for this repo

Every PR here gets merged (squash) as soon as its `eslint` check passes —
this is a personal project, no human review gate. After a PR merges, the
feature branch (`claude/premier-league-dashboard-8ko6qw`) is **behind**
main again. Before starting new work: `git fetch origin main && git
checkout -B <branch> origin/main`, then cherry-pick or redo the new
change on top — never push directly on top of already-merged history on
this branch.

Scheduled workflows (`lineups.yml`, `odds.yml`) commit directly to `main`
outside of PRs (`chore: update ...`), so `main` moves on its own between
your sessions too — always `git fetch origin main` immediately before
branching, not just before pushing.

## UI notes

- Dark theme: `epl-bg` / `epl-surface` / `epl-surface2` Tailwind tokens.
- Team detail: squad list + illustrative/confirmed formation view
  side-by-side (desktop) / stacked (mobile) — never a toggle, both are
  always visible when data exists.
- Match odds (Kalshi) only apply to the **Fixtures** tab, never Results.
  Both tabs wire `onSelectMatch` in `App.jsx`, but to different dialogs:
  Fixtures opens `MatchOddsDialog`, Results opens `MatchStatsDialog` - a
  live match in either tab has `onSelectMatch` set to `undefined` instead
  (odds don't apply mid-match, and stats aren't final yet).
