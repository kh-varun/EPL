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
  as empty) - presumably API-Football stores their name with different
  punctuation in a spot that breaks a literal-substring match no matter how
  the query is cleaned up. `findApiFootballTeamId` falls back to just the
  first word of the shortName as a third, narrower attempt - a single common
  word is far more likely to appear literally in their name however it's
  punctuated, and `teamsLikelyMatch`'s word-boundary check afterward still
  guards against a too-broad query matching the wrong club.
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

## All four fetch workflows retry their push

`update.yml`, `lineups.yml`, `odds.yml`, and `history.yml` each fetch,
commit, and `git push` straight to `main` independently. Since
`lineups.yml`/`odds.yml` fire every 15 minutes and `update.yml`'s full
squad-fetch loop alone takes several minutes, two of them landing at once
is a real, confirmed-live race - not theoretical: `update.yml` fetched
successfully, committed locally, then got its push rejected as
non-fast-forward because another workflow had pushed to `main` in the
meantime, and the whole run's fetched data was discarded since there was
no retry. Every commit step now does fetch + rebase + push in a retry loop
instead of a single bare `git push` - keep that pattern on any new
scheduled-write workflow added to this repo.

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
- Match odds (Kalshi) only apply to the **Fixtures** tab, never Results —
  `onSelectMatch` is only wired up there in `App.jsx`.
