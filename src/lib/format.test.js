import { describe, it, expect } from "vitest";
import {
  formatMatchDateTime,
  formatRelativeUpdated,
  formatUpdatedTimestamp,
  formatHeadlineAge,
} from "./format.js";

describe("formatMatchDateTime", () => {
  it("renders a Pacific-time date and time with a PT suffix", () => {
    // 2026-08-30T13:00:00Z is 06:00 PT (PDT, UTC-7) in late August.
    expect(formatMatchDateTime("2026-08-30T13:00:00Z")).toBe("Sun, Aug 30 · 6:00 AM PT");
  });
});

describe("formatRelativeUpdated", () => {
  it("says 'just now' for anything under a minute old", () => {
    expect(formatRelativeUpdated(new Date().toISOString())).toBe("just now");
  });

  it("renders minutes for anything under an hour old", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatRelativeUpdated(tenMinAgo)).toBe("10m ago");
  });

  it("renders hours for anything under a day old", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeUpdated(threeHoursAgo)).toBe("3h ago");
  });

  it("renders days for anything a day or older", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeUpdated(twoDaysAgo)).toBe("2d ago");
  });
});

describe("formatUpdatedTimestamp", () => {
  it("renders a full weekday/date/time stamp with a PT suffix", () => {
    expect(formatUpdatedTimestamp("2026-08-30T13:00:00Z")).toBe("Sun, Aug 30, 6:00 AM PT");
  });
});

describe("formatHeadlineAge", () => {
  it("returns an empty string when there's no pubDate", () => {
    expect(formatHeadlineAge(null)).toBe("");
    expect(formatHeadlineAge(undefined)).toBe("");
  });

  it("delegates to formatRelativeUpdated when a pubDate is given", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatHeadlineAge(oneHourAgo)).toBe("1h ago");
  });
});
