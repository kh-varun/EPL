// Sanity checks against the actual, currently-committed public/*.json data
// files - not fixtures. These files are this project's database (fetched by
// scheduled GitHub Actions workflows, no server behind them), so an
// invariant broken here means production is currently serving broken data,
// not that a test fixture needs updating.
//
// This is the automated version of the manual "read data.json, notice
// something looks wrong" checks this project has repeatedly needed - e.g.
// the ~7-week gap in nextFixtures, and the four already-finished matches
// stuck in nextFixtures as still upcoming, both found this way by hand.
// Run on a schedule (see .github/workflows/data-qa.yml), not just on PRs,
// since the data can go bad without any code change at all.

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

async function readJson(name) {
  const raw = await readFile(path.join(PUBLIC_DIR, name), "utf-8");
  return JSON.parse(raw);
}

// Generous on purpose - a real Premier League gap (international break,
// season boundary) can run 2-3 weeks; this only needs to catch something
// like the ~7-week gap that was actually confirmed live, not flag every
// quiet week.
const MAX_REASONABLE_FIXTURE_GAP_DAYS = 24;

describe("public/data.json", () => {
  it("parses and has the expected top-level shape", async () => {
    const data = await readJson("data.json");
    expect(typeof data.fetchedAt).toBe("string");
    expect(Array.isArray(data.standings)).toBe(true);
    expect(Array.isArray(data.nextFixtures)).toBe(true);
    expect(Array.isArray(data.lastResults)).toBe(true);
  });

  it("has a complete 20-team standings table, ordered by position", async () => {
    const data = await readJson("data.json");
    if (data.standings.length === 0) return; // not fetched yet - nothing to check

    expect(data.standings).toHaveLength(20);

    const teamIds = new Set(data.standings.map((row) => row.team.id));
    expect(teamIds.size).toBe(20);

    // football-data.org's own `position` field can tie two teams on the same
    // number this early in the season (confirmed live: two pairs of teams
    // sharing points/goal difference both came back as joint 14th and joint
    // 19th, with no team at 15th or 20th) - not a bug on our end, so this
    // only checks positions stay in range and non-decreasing, not that
    // they're a clean, gapless 1-20 sequence.
    const positions = data.standings.map((row) => row.position);
    for (const position of positions) {
      expect(position).toBeGreaterThanOrEqual(1);
      expect(position).toBeLessThanOrEqual(20);
    }
    const sorted = [...positions].sort((a, b) => a - b);
    expect(sorted).toEqual(positions);
  });

  it("lists nextFixtures in chronological order with no team facing itself", async () => {
    const data = await readJson("data.json");
    for (const fixture of data.nextFixtures) {
      expect(fixture.homeTeam.id).not.toBe(fixture.awayTeam.id);
    }

    const dates = data.nextFixtures.map((f) => new Date(f.utcDate).getTime());
    const sorted = [...dates].sort((a, b) => a - b);
    expect(dates).toEqual(sorted);
  });

  it("doesn't have an unexplained multi-week gap between now and the next fixture", async () => {
    const data = await readJson("data.json");
    if (data.nextFixtures.length === 0) return; // nothing scheduled yet - not this check's job

    const now = Date.now();
    const firstKickoff = new Date(data.nextFixtures[0].utcDate).getTime();
    const gapDays = (firstKickoff - now) / (24 * 60 * 60 * 1000);

    // A negative gap (the "next" fixture is already in the past) is exactly
    // the class of bug this project has hit before via a different path
    // (fetch-live-scores.mjs's stale-candidate handling) - flag it here too.
    expect(gapDays).toBeGreaterThanOrEqual(-1);
    expect(gapDays).toBeLessThanOrEqual(MAX_REASONABLE_FIXTURE_GAP_DAYS);
  });

  it("lists lastResults in reverse-chronological order, all genuinely finished", async () => {
    const data = await readJson("data.json");
    for (const match of data.lastResults) {
      expect(match.status).toBe("FINISHED");
      expect(match.score.home).not.toBeNull();
      expect(match.score.away).not.toBeNull();
    }

    const dates = data.lastResults.map((m) => new Date(m.utcDate).getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });
});

describe("public/live-scores.json", () => {
  it("parses and has the expected top-level shape", async () => {
    const data = await readJson("live-scores.json");
    expect(typeof data.fetchedAt).toBe("string");
    expect(typeof data.matches).toBe("object");
  });

  it("never carries a match whose kickoff was implausibly long ago", async () => {
    const data = await readJson("live-scores.json");
    const now = Date.now();
    for (const match of Object.values(data.matches)) {
      const ageHours = (now - new Date(match.utcDate).getTime()) / (60 * 60 * 1000);
      expect(ageHours).toBeLessThan(6);
    }
  });
});

describe("public/odds.json", () => {
  it("parses and has the expected top-level shape", async () => {
    const data = await readJson("odds.json");
    expect(typeof data.fetchedAt).toBe("string");
    expect(typeof data.odds).toBe("object");
  });
});
