#!/usr/bin/env node
// Fetches Premier League match-outcome markets from Kalshi (a CFTC-regulated
// prediction market exchange) for our upcoming fixtures. Kalshi's market
// data is fully public - no API key, no signup - via the KXEPLGAME series,
// which lists a three-way (home win / away win / draw) event per match.
//
// A market's price (1-99 cents) is the exchange's live implied probability
// of that outcome. This is real-money trading data, not a bookmaker's odds
// and not betting advice - the UI must present it as such, with a link back
// to Kalshi for anyone who wants to see the source.
//
// No secrets required.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "public", "data.json");
const OUT_PATH = path.join(__dirname, "..", "public", "odds.json");

const KALSHI_BASE = "https://external-api.kalshi.com/trade-api/v2";
const SERIES_TICKER = "KXEPLGAME";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function kalshiRequest(endpoint) {
  const res = await fetch(`${KALSHI_BASE}${endpoint}`);
  if (!res.ok) {
    throw new Error(`Kalshi ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAllEvents() {
  const events = [];
  let cursor;

  do {
    const qs = new URLSearchParams({
      series_ticker: SERIES_TICKER,
      status: "open",
      with_nested_markets: "true",
      limit: "200",
    });
    if (cursor) qs.set("cursor", cursor);

    const body = await kalshiRequest(`/events?${qs}`);
    events.push(...(body.events ?? []));
    cursor = body.cursor || null;
    if (cursor) await sleep(300);
  } while (cursor);

  return events;
}

async function fetchMarketsForEvent(eventTicker) {
  const body = await kalshiRequest(
    `/markets?${new URLSearchParams({ event_ticker: eventTicker, status: "open" })}`,
  );
  return body.markets ?? [];
}

function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/\bfc\b|\bafc\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Clubs whose common short name doesn't share a word with the name Kalshi
// uses in its event titles, so substring matching alone can't connect them.
const NAME_ALIASES = {
  wolverhampton: ["wolves"],
  "wolverhampton wanderers": ["wolves"],
  spurs: ["tottenham"],
  tottenham: ["spurs"],
};

function teamsLikelyMatch(ourTeam, theirName) {
  const ours = [normalizeTeamName(ourTeam.name), normalizeTeamName(ourTeam.shortName)];
  const withAliases = ours.flatMap((name) => [name, ...(NAME_ALIASES[name] ?? [])]);
  const theirs = normalizeTeamName(theirName);
  return withAliases.some(
    (name) => name === theirs || theirs.includes(name) || name.includes(theirs),
  );
}

// Kalshi event titles look like "Wolverhampton vs Chelsea", home team first.
function splitEventTitle(title) {
  const parts = title.split(/\s+vs\.?\s+/i);
  return parts.length === 2 ? { home: parts[0].trim(), away: parts[1].trim() } : null;
}

function matchEventToFixture(event, fixtures) {
  const split = splitEventTitle(event.title ?? "");
  if (!split) return null;

  return fixtures.find(
    (fixture) =>
      teamsLikelyMatch(fixture.homeTeam, split.home) &&
      teamsLikelyMatch(fixture.awayTeam, split.away),
  );
}

// A market's implied probability, as a whole-number percentage. Prefer the
// last traded price; if nothing has traded yet, fall back to the mid of the
// current bid/ask spread.
function impliedProbability(market) {
  if (market.last_price) return market.last_price;
  if (market.yes_bid != null && market.yes_ask != null) {
    return Math.round((market.yes_bid + market.yes_ask) / 2);
  }
  return null;
}

function classifyMarket(market, fixture) {
  const label = (market.yes_sub_title || market.subtitle || market.title || "").toLowerCase();
  if (/\btie\b|\bdraw\b/.test(label)) return "draw";
  if (teamsLikelyMatch(fixture.homeTeam, label)) return "home";
  if (teamsLikelyMatch(fixture.awayTeam, label)) return "away";
  return null;
}

// Once per run, dump one full market object verbatim so a classification
// failure is diagnosable from the Actions log - which field actually holds
// the outcome name is the thing we can't verify without a live response.
let dumpedSampleMarket = false;

async function buildOddsForEvent(event, fixture) {
  const markets = event.markets?.length ? event.markets : await fetchMarketsForEvent(event.event_ticker);

  const result = { eventTicker: event.event_ticker, kalshiUrl: null, home: null, away: null, draw: null };

  for (const market of markets) {
    const side = classifyMarket(market, fixture);
    if (!side) continue;

    const probability = impliedProbability(market);
    if (probability == null) continue;

    result[side] = {
      label: side === "draw" ? "Draw" : fixture[`${side}Team`].shortName,
      probability,
      ticker: market.ticker,
    };
  }

  if (!result.home && !result.away && !result.draw) {
    console.log(
      `  matched "${event.title}" to a fixture but couldn't classify any of its ` +
        `${markets.length} market(s)`,
    );
    if (!dumpedSampleMarket && markets.length > 0) {
      console.log(`  sample market object: ${JSON.stringify(markets[0])}`);
      dumpedSampleMarket = true;
    }
    return null;
  }

  const slug = event.event_ticker.toLowerCase();
  result.kalshiUrl = `https://kalshi.com/markets/${SERIES_TICKER.toLowerCase()}/english-premier-league-game/${slug}`;
  return result;
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, "utf-8"));
  const fixtures = data.nextFixtures ?? [];

  if (fixtures.length === 0) {
    console.log("No upcoming fixtures to look up.");
    return;
  }

  console.log(`Fetching Kalshi ${SERIES_TICKER} events...`);
  let events;
  try {
    events = await fetchAllEvents();
  } catch (err) {
    console.error(`Could not fetch Kalshi events: ${err.message}`);
    console.log("Leaving public/odds.json untouched.");
    return;
  }
  console.log(`Found ${events.length} open event(s) in the series.`);
  console.log(
    `Our upcoming fixtures: ${fixtures.map((f) => `${f.homeTeam.shortName} v ${f.awayTeam.shortName}`).join(", ")}`,
  );

  const odds = {};

  for (const event of events) {
    const fixture = matchEventToFixture(event, fixtures);
    if (!fixture) {
      // Log every miss with the raw title, so a run that matches nothing
      // is debuggable from the Actions log instead of a bare zero.
      console.log(`  no fixture match for "${event.title}" (${event.event_ticker})`);
      continue;
    }

    try {
      const entry = await buildOddsForEvent(event, fixture);
      if (entry) {
        odds[fixture.id] = entry;
        console.log(
          `  ${fixture.homeTeam.shortName} v ${fixture.awayTeam.shortName}: ` +
            `${entry.home?.probability ?? "?"}/${entry.draw?.probability ?? "?"}/${entry.away?.probability ?? "?"}`,
        );
      }
    } catch (err) {
      console.error(`  ${event.event_ticker}: ${err.message}`);
    }

    await sleep(300);
  }

  console.log(`Matched odds for ${Object.keys(odds).length}/${fixtures.length} upcoming fixtures.`);

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify({ fetchedAt: new Date().toISOString(), odds }, null, 2) + "\n");
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
