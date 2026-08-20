# EPL Dashboard

Static Premier League 2026-27 dashboard (Vite + React + Tailwind, dark
theme), deployed to GitHub Pages. Mobile-first. All data comes from free
APIs via scheduled GitHub Actions workflows that commit static JSON into
`public/`; the React app just fetches those files at runtime.

## Data pipeline (`scripts/*.mjs` → workflows)

| Script | Writes | Workflow | Schedule | Needs |
|---|---|---|---|---|
| `fetch.mjs` | `public/data.json` | `update.yml` | Weekly (Wed) | `FOOTBALL_DATA_TOKEN`, `API_FOOTBALL_KEY` (optional, for manager names) |
| `fetch-lineups.mjs` | `public/lineups.json` | `lineups.yml` | Every 15 min | `API_FOOTBALL_KEY` |
| `fetch-history.mjs` | `public/history.json` | `history.yml` | Monthly | `FOOTBALL_DATA_TOKEN`, `API_FOOTBALL_KEY` (optional) |
| `fetch-odds.mjs` | `public/odds.json` | `odds.yml` | Every 15 min | none (Kalshi is public) |

All scripts degrade gracefully: a missing key or a failed call never
crashes the run or corrupts existing JSON — it just leaves that piece of
data as `null`/empty and logs why. Never remove that pattern when editing
these scripts.

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
  for Arsenal, Klopp for Liverpool, Xabi Alonso for Chelsea, all long gone).
  `fetch.mjs` always prefers the API-Football lookup when a key is set and
  only falls back to football-data.org's value if that lookup fails.
- **API-Football's `/coachs?team=` returns every coach who's ever had a
  career entry at that team, not just the current one** — `fetchCurrentCoach`
  in `fetch.mjs` picks the entry whose career record for that team has no
  `end` date rather than trusting the first result.
- Rate limits: football-data.org free tier is 10 req/min; API-Football
  free tier is 10 req/min / 100 req/day. Every script throttles with a
  ~6.5s delay between calls — don't remove it, and be aware that adding
  more per-team API calls multiplies total job runtime linearly (~20
  teams × Ns delay per call).

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
