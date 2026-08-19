# EPL

A static Premier League 2026-27 dashboard: standings, upcoming fixtures,
recent results, squads with formation views, and football headlines. Built
with Vite + React + Tailwind, deployed to GitHub Pages.

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

## Automation

- `.github/workflows/update.yml` refreshes `public/data.json` every
  Wednesday and on manual dispatch, committing the file if it changed.
  Requires a `FOOTBALL_DATA_TOKEN` repository secret.
- `.github/workflows/lineups.yml` refreshes `public/lineups.json` every 15
  minutes, committing only when lineups actually change. Requires an
  `API_FOOTBALL_KEY` repository secret.
- `.github/workflows/pr-review.yml` runs ESLint on every PR and posts
  findings as inline review comments via reviewdog.
- `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on
  every push to `main`.
