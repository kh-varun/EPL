import { describe, it, expect } from "vitest";
import { normalizeTeamName, teamsLikelyMatch, searchableTeamName } from "./api-football.mjs";

describe("normalizeTeamName", () => {
  it("lowercases, strips FC/AFC, and collapses punctuation to spaces", () => {
    expect(normalizeTeamName("Brighton & Hove Albion FC")).toBe("brighton hove albion");
  });
});

describe("searchableTeamName", () => {
  it("strips FC/AFC suffixes so the search term matches API-Football's own name", () => {
    expect(searchableTeamName("Manchester City FC")).toBe("Manchester City");
    expect(searchableTeamName("Manchester United FC")).toBe("Manchester United");
  });

  it("strips punctuation API-Football's search field rejects outright", () => {
    expect(searchableTeamName("Brighton & Hove Albion FC")).toBe("Brighton Hove Albion");
  });
});

describe("teamsLikelyMatch", () => {
  it("matches via the shortName or full name", () => {
    const arsenal = { name: "Arsenal FC", shortName: "Arsenal" };
    expect(teamsLikelyMatch(arsenal, "Arsenal")).toBe(true);
  });

  it("uses the Wolves alias", () => {
    const wolves = { name: "Wolverhampton Wanderers FC", shortName: "Wolves" };
    expect(teamsLikelyMatch(wolves, "Wolverhampton")).toBe(true);
  });

  it("does not false-positive on an unrelated club with an overlapping substring", () => {
    // Regression case documented in CLAUDE.md: a plain includes() check
    // wrongly matched "Man City"/"Man United" against these real, unrelated
    // clubs API-Football's search actually returned.
    const manCity = { name: "Manchester City FC", shortName: "Man City" };
    expect(teamsLikelyMatch(manCity, "Techiman City")).toBe(false);

    const manUnited = { name: "Manchester United FC", shortName: "Man United" };
    expect(teamsLikelyMatch(manUnited, "Cwmamman United FC")).toBe(false);
  });

  it("matches bidirectionally when API-Football's name has fewer words than ours", () => {
    // Regression case documented in CLAUDE.md: API-Football's own name for
    // Brighton & Hove Albion is apparently just "Brighton" - requiring all
    // of *our* words in *theirs* can never pass, so the check must also try
    // the other direction (all of theirs in ours).
    const brighton = { name: "Brighton & Hove Albion FC", shortName: "Brighton Hove" };
    expect(teamsLikelyMatch(brighton, "Brighton")).toBe(true);
  });
});
