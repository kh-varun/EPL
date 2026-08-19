# EPL

A static Premier League 2026-27 dashboard: standings, upcoming fixtures,
recent results, and football headlines. Built with Vite + React + Tailwind,
deployed to GitHub Pages.

## Setup

```bash
npm install
cp .env.example .env   # fill in FOOTBALL_DATA_TOKEN
npm run fetch-data     # writes public/data.json
npm run dev
```

Get a free API token at https://www.football-data.org/client/register.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/`
- `npm run fetch-data` — refresh `public/data.json` from football-data.org
  and RSS headlines (BBC Sport, The Guardian)

## Automation

- `.github/workflows/update.yml` refreshes `public/data.json` every
  Wednesday and on manual dispatch, committing the file if it changed.
  Requires a `FOOTBALL_DATA_TOKEN` repository secret.
- `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on
  every push to `main`.
