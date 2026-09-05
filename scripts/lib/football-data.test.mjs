import { describe, it, expect } from "vitest";
import { mapTeam, mapMatch, isFixtureFresh } from "./football-data.mjs";

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
