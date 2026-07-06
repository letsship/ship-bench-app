import { describe, expect, it } from "vitest";
import { formatDayLabel } from "./format";

describe("formatDayLabel", () => {
  it("formats the weekday, day, and month for a given timezone", () => {
    expect(formatDayLabel("2026-06-15T10:00:00.000Z", "Europe/Amsterdam")).toBe("Monday 15 June");
  });

  it("uses the studio timezone's calendar day, not UTC's", () => {
    // 23:30 UTC on the 15th is already 01:30 on the 16th in Amsterdam (UTC+2 in June).
    const instant = "2026-06-15T23:30:00.000Z";
    expect(formatDayLabel(instant, "UTC")).toBe("Monday 15 June");
    expect(formatDayLabel(instant, "Europe/Amsterdam")).toBe("Tuesday 16 June");
  });

  it("uses the studio timezone's calendar day even when it's earlier than UTC's", () => {
    // 00:30 UTC on the 16th is still 20:30 on the 15th in New York (UTC-4 in June).
    const instant = "2026-06-16T00:30:00.000Z";
    expect(formatDayLabel(instant, "UTC")).toBe("Tuesday 16 June");
    expect(formatDayLabel(instant, "America/New_York")).toBe("Monday 15 June");
  });
});
