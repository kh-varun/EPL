# EPL

A static Premier League 2026-27 dashboard: standings, upcoming fixtures with
live match-outcome odds, recent results, squads with formation views, and
football headlines. Built with Vite + React + Tailwind, deployed to GitHub
Pages.

## Setup

```bash
npm install
cp .env.example .env   # fill in FOOTBALL_DATA_TOKEN and API_FOOTBALL_KEY
npm run fetch-data     # writes public/data.json
npm run dev
```

- `FOOTBALL_DATA_TOKEN` — free token from https://www.football-data.org/client/register
  (standings, fixtures, results, squads)
- `API_FOOTBALL_KEY` — free key from https://dashboard.api-football.com
  (confirmed match-day lineups; 100 requests/day on the free plan)

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint
- `npm run fetch-data` — refresh `public/data.json` from football-data.org
  and RSS headlines (BBC Sport, The Guardian)
- `npm run fetch-lineups` — refresh `public/lineups.json` with confirmed
  starting XIs from API-Football
- `npm run fetch-history` — refresh `public/history.json` with last
  season's final table (football-data.org) and player stats
  (API-Football, best-effort - see below)
- `npm run fetch-odds` — refresh `public/odds.json` with live match-outcome
  odds from Kalshi (no key required - see below)

## Confirmed lineups

Official team sheets aren't published until roughly 20-40 minutes before
kickoff, so `fetch-lineups` is built to run frequently and cheaply: it exits
without making any API calls unless one of our upcoming fixtures is within
3 hours of kickoff. That keeps usage far below the free plan's 100/day cap
while still catching lineups as soon as they're released.

The Formation panel shows the real starting XI (plus substitutes and the
actual formation) when one is available, and otherwise falls back to an
illustrative 4-3-3 built from the squad list. The two are labeled
distinctly — "Confirmed XI" vs "Illustrative" — so it's always clear which
you're looking at.

## Last-season history

Team detail shows last season's final position, record and goal stats -
this comes from football-data.org and works reliably on the free tier.

Player detail additionally shows last season's appearances/goals/assists/
rating when available, from API-Football's `/players` endpoint. This is
best-effort: API-Football's free plan restricts how far back you can query
player statistics, so on some accounts this may come back empty. When it
does, the dashboard says so explicitly instead of showing broken or
misleading data - the team history above is unaffected either way, since
the two are fetched and degrade independently.

## Match odds

Clicking a fixture in the Fixtures tab opens a dialog with live win/draw/win
probabilities, sourced from [Kalshi](https://kalshi.com/category/sports/soccer/epl),
a CFTC-regulated prediction market — no API key needed, since Kalshi's market
data is fully public. Each fixture card also shows a compact three-segment
probability bar as a preview.

This is real-money trading data (Kalshi lists per-match win/draw/win
contracts under its `KXEPLGAME` series), so it's presented as an informational
market-implied probability with a link back to Kalshi — not betting advice,
and not guaranteed to line up with any bookmaker's odds. If a match doesn't
have a market listed yet (common for fixtures more than a few days out), the
dialog says so instead of showing nothing.

## Automation

- `.github/workflows/update.yml` refreshes `public/data.json` every
  Wednesday and on manual dispatch, committing the file if it changed.
  Requires a `FOOTBALL_DATA_TOKEN` repository secret.
- `.github/workflows/lineups.yml` refreshes `public/lineups.json` every 15
  minutes, committing only when lineups actually change. Requires an
  `API_FOOTBALL_KEY` repository secret.
- `.github/workflows/history.yml` refreshes `public/history.json` monthly
  (last season's numbers don't change mid-season) and on manual dispatch.
  Uses both `FOOTBALL_DATA_TOKEN` and `API_FOOTBALL_KEY`.
- `.github/workflows/odds.yml` refreshes `public/odds.json` every 15
  minutes. No secrets required - Kalshi's market data is public.
- `.github/workflows/pr-review.yml` runs ESLint on every PR and posts
  findings as inline review comments via reviewdog.
- `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on
  every push to `main`.
