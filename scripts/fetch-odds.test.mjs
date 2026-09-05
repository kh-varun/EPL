import { describe, it, expect } from "vitest";
import {
  normalizeTeamName,
  teamsLikelyMatch,
  splitEventTitle,
  impliedProbability,
  classifyMarket,
} from "./fetch-odds.mjs";

describe("normalizeTeamName", () => {
  it("lowercases, strips FC/AFC, and collapses punctuation to spaces", () => {
    expect(normalizeTeamName("Brighton & Hove Albion FC")).toBe("brighton hove albion");
    expect(normalizeTeamName("AFC Bournemouth")).toBe("bournemouth");
  });
});

describe("teamsLikelyMatch", () => {
  it("matches via the shortName or full name", () => {
    const arsenal = { name: "Arsenal FC", shortName: "Arsenal" };
    expect(teamsLikelyMatch(arsenal, "Arsenal")).toBe(true);
  });

  it("uses the alias table for Wolves and Spurs", () => {
    const wolves = { name: "Wolverhampton Wanderers FC", shortName: "Wolves" };
    expect(teamsLikelyMatch(wolves, "Wolverhampton")).toBe(true);

    const spurs = { name: "Tottenham Hotspur FC", shortName: "Tottenham" };
    expect(teamsLikelyMatch(spurs, "Spurs")).toBe(true);
  });

  it("does not false-positive on an unrelated club with an overlapping substring", () => {
    // Regression case documented in CLAUDE.md: naive substring matching
    // wrongly matched "Man City"/"Man United" against unrelated clubs.
    const manCity = { name: "Manchester City FC", shortName: "Man City" };
    expect(teamsLikelyMatch(manCity, "Techiman City")).toBe(false);

    const manUnited = { name: "Manchester United FC", shortName: "Man United" };
    expect(teamsLikelyMatch(manUnited, "Cwmamman United FC")).toBe(false);
  });
});

describe("splitEventTitle", () => {
  it("splits a 'Home vs Away' title on the vs separator", () => {
    expect(splitEventTitle("Wolverhampton vs Chelsea")).toEqual({
      home: "Wolverhampton",
      away: "Chelsea",
    });
  });

  it("returns null for a title with no vs separator", () => {
    expect(splitEventTitle("Wolverhampton Chelsea")).toBeNull();
  });
});

describe("impliedProbability", () => {
  it("prefers the last traded price, as a whole-number percentage", () => {
    expect(impliedProbability({ last_price_dollars: "0.8400" })).toBe(84);
  });

  it("falls back to the bid/ask midpoint when nothing has traded", () => {
    expect(
      impliedProbability({ last_price_dollars: "0", yes_bid_dollars: "0.40", yes_ask_dollars: "0.44" }),
    ).toBe(42);
  });

  it("returns null when neither a trade nor a bid/ask spread is available", () => {
    expect(impliedProbability({})).toBeNull();
  });
});

describe("classifyMarket", () => {
  const fixture = {
    homeTeam: { name: "Arsenal FC", shortName: "Arsenal" },
    awayTeam: { name: "Chelsea FC", shortName: "Chelsea" },
  };

  it("classifies a draw market by keyword", () => {
    expect(classifyMarket({ yes_sub_title: "Draw" }, fixture)).toBe("draw");
    expect(classifyMarket({ yes_sub_title: "Tie" }, fixture)).toBe("draw");
  });

  it("classifies a home or away win market by team name", () => {
    expect(classifyMarket({ yes_sub_title: "Arsenal" }, fixture)).toBe("home");
    expect(classifyMarket({ yes_sub_title: "Chelsea" }, fixture)).toBe("away");
  });

  it("returns null when the label matches neither team nor draw", () => {
    expect(classifyMarket({ yes_sub_title: "Something else" }, fixture)).toBeNull();
  });
});
