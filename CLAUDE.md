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
| `fetch-live-scores.mjs` | `public/live-scores.json`, `public/match-stats.json` | `live-scores.yml` | Every 10 min | `FOOTBALL_DATA_TOKEN`; `API_FOOTBALL_KEY` (optional, for match stats) |

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

`fetch-live-scores.mjs` runs every 10 minutes but only makes a
football-data.org call when some match's kickoff time falls within its
polling window (15 min before through 3 hours after) - checked against the
already-cached `nextFixtures`/`lastResults` in `data.json`, at zero API
cost, before ever hitting the network. When something's actually live, it
queries `/matches?status=IN_PLAY,PAUSED` and writes `live-scores.json`
keyed by match id; when nothing is, it clears the file so a finished
match's score doesn't linger with a stale "LIVE" badge. `App.jsx` also
polls this file client-side every 60s (unlike the other JSON files, which
are only fetched once on load) so a tab left open updates without a
reload - the underlying file only changes every ~10 min regardless.
`MatchRow` reads `match.liveStatus` (set by `withLiveScore` in `App.jsx`)
to swap in the red "LIVE"/"HT" badge and score pill.

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
match just finished, so the result and table land within ~10 minutes of
full time instead of waiting up to a week. It deliberately leaves
`teams`/`headlines` untouched (squads and news don't change mid-match) and
does not re-run the expensive per-team squad/coach fetch.

## Match stats dialog

Clicking a finished match on the Results tab opens `MatchStatsDialog`
(shots, shots on target, possession, passes, pass accuracy, fouls, corners,
offsides, cards per side) - deliberately just the stats breakdown, not an
embedded highlights video or a goal-scorer timeline (the latter would need
a third API-Football call per match - `/fixtures/events` - which wasn't
worth the extra shared-quota spend for what was asked).

The same moment `fetch-live-scores.mjs` detects a match just went from live
to finished, it also resolves that match's API-Football fixture id (reusing
`findApiFootballFixtureId`, the same date+`teamsLikelyMatch` lookup
`fetch-lineups.mjs` already relies on) and calls
`/fixtures/statistics?fixture=` for both teams' stats, writing the result to
`public/match-stats.json` keyed by our (football-data.org) match id. A
finished match's stats never change, so each match is only ever fetched
once - already-cached matches are skipped on every later run. Optional and
gracefully degrading like every other API-Football feature here: skipped
entirely without `API_FOOTBALL_KEY`, gated behind the same
`hasApiFootballQuotaFor` pre-check, and a per-match failure just leaves that
match without a stats breakdown rather than failing the run.

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
id from `lastResults`, bypassing the normal just-finished-transition
detection - needed because the very first match of the season (Arsenal v
Coventry) had already fallen out of `live-scores.json`'s tracked "was live"
state by the time this feature shipped, so there was no transition left for
the normal path to detect naturally. Useful going forward too, as a retry
knob for any match whose stats fetch failed the first time.

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
