import { describe, it, expect, vi, afterEach } from "vitest";
import {
  mapTeam,
  mapMatch,
  isFixtureFresh,
  fetchStandings,
  fetchLastResults,
  fetchNextFixtures,
} from "./football-data.mjs";

describe("mapTeam", () => {
  it("picks out only the fields the dashboard needs", () => {
    const team = mapTeam({
      id: 57,
      name: "Arsenal FC",
      shortName: "Arsenal",
      tla: "ARS",
      crest: "https://example.com/arsenal.png",
      extraField: "should be dropped",
    });
    expect(team).toEqual({
      id: 57,
      name: "Arsenal FC",
      shortName: "Arsenal",
      tla: "ARS",
      crest: "https://example.com/arsenal.png",
    });
  });
});

describe("mapMatch", () => {
  it("maps a finished match's score and winner", () => {
    const match = mapMatch({
      id: 1,
      utcDate: "2026-08-30T13:00:00Z",
      status: "FINISHED",
      matchday: 2,
      homeTeam: { id: 61, name: "Chelsea FC", shortName: "Chelsea", tla: "CHE", crest: "c.png" },
      awayTeam: { id: 397, name: "Brighton & Hove Albion FC", shortName: "Brighton Hove", tla: "BHA", crest: "b.png" },
      score: { fullTime: { home: 4, away: 3 }, winner: "HOME_TEAM" },
    });
    expect(match.score).toEqual({ home: 4, away: 3, winner: "HOME_TEAM" });
    expect(match.homeTeam.shortName).toBe("Chelsea");
    expect(match.awayTeam.shortName).toBe("Brighton Hove");
  });

  it("fills in nulls for a match with no score yet", () => {
    const match = mapMatch({
      id: 2,
      utcDate: "2026-09-05T14:00:00Z",
      status: "TIMED",
      matchday: 3,
      homeTeam: { id: 65, name: "Manchester City FC", shortName: "Man City", tla: "MCI", crest: "m.png" },
      awayTeam: { id: 66, name: "Coventry City FC", shortName: "Coventry City", tla: "COV", crest: "cov.png" },
      score: { fullTime: { home: null, away: null }, winner: null },
    });
    expect(match.score).toEqual({ home: null, away: null, winner: null });
  });
});

describe("isFixtureFresh", () => {
  const now = new Date("2026-09-05T00:00:00Z").getTime();

  it("keeps a match that hasn't kicked off yet, no matter how far out", () => {
    expect(isFixtureFresh({ utcDate: "2026-10-25T14:00:00Z" }, now)).toBe(true);
  });

  it("keeps a match that kicked off recently", () => {
    expect(isFixtureFresh({ utcDate: "2026-09-04T22:00:00Z" }, now)).toBe(true);
  });

  it("drops a match whose kickoff is more than 4 hours in the past", () => {
    // The exact regression this guards: football-data.org's status-filtered
    // endpoint kept reporting matches from the previous day as still
    // SCHEDULED/TIMED well after they'd actually finished.
    expect(isFixtureFresh({ utcDate: "2026-09-03T00:00:00Z" }, now)).toBe(false);
  });
});

function mockFetchOnce(body) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Champions League support added a competitionCode param to all three
// fetch functions, defaulting to "PL" so every pre-existing call site
// (fetch.mjs, fetch-live-scores.mjs) keeps working unchanged.
describe("competitionCode parameter", () => {
  it("defaults to PL when no competition is given", async () => {
    mockFetchOnce({ standings: [{ type: "TOTAL", table: [] }] });
    await fetchStandings();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/competitions/PL/standings"),
      expect.anything(),
    );
  });

  it("fetchStandings queries the given competition", async () => {
    mockFetchOnce({ standings: [{ type: "TOTAL", table: [] }] });
    await fetchStandings("CL");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/competitions/CL/standings"),
      expect.anything(),
    );
  });

  it("fetchLastResults queries the given competition", async () => {
    mockFetchOnce({ matches: [] });
    await fetchLastResults(5, "CL");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/competitions/CL/matches?status=FINISHED"),
      expect.anything(),
    );
  });

  it("fetchNextFixtures queries the given competition", async () => {
    mockFetchOnce({ matches: [] });
    await fetchNextFixtures(10, "CL");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/competitions/CL/matches?status=SCHEDULED,IN_PLAY,PAUSED"),
      expect.anything(),
    );
  });
});

describe("fetchStandings TOTAL-group fallback", () => {
  it("falls back to the first group when there's no TOTAL group", async () => {
    // The Champions League's single-table league-phase standings shape is
    // unconfirmed against a live response - this covers the fallback path
    // in case it isn't grouped under "TOTAL" the way the Premier League's is.
    mockFetchOnce({
      standings: [
        {
          type: "SOME_OTHER_GROUP",
          table: [
            {
              position: 1,
              team: { id: 1, name: "Real Madrid CF", shortName: "Real Madrid", tla: "RMA", crest: "r.png" },
              playedGames: 1,
              won: 1,
              draw: 0,
              lost: 0,
              points: 3,
              goalsFor: 2,
              goalsAgainst: 0,
              goalDifference: 2,
              form: "W",
            },
          ],
        },
      ],
    });
    const standings = await fetchStandings("CL");
    expect(standings).toHaveLength(1);
    expect(standings[0].team.shortName).toBe("Real Madrid");
  });
});
