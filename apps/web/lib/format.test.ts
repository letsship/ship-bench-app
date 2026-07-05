import { describe, expect, it } from "vitest";
import { formatDayLabel } from "./format";

describe("formatDayLabel", () => {
  it("formats as 'Weekday D Month' in the given timezone", () => {
    expect(formatDayLabel("2026-06-15T10:00:00.000Z", "Europe/Amsterdam")).toBe("Monday 15 June");
  });

  it("formats the same instant differently across timezones", () => {
    expect(formatDayLabel("2026-06-15T10:00:00.000Z", "UTC")).toBe("Monday 15 June");
    expect(formatDayLabel("2026-06-15T10:00:00.000Z", "America/Los_Angeles")).toBe(
      "Monday 15 June",
    );
  });

  it("resolves to different calendar days depending on timezone near midnight UTC", () => {
    // 2026-06-15T23:30Z is still 15 June in UTC, but already 16 June in
    // Europe/Amsterdam (UTC+2 in summer).
    const instant = "2026-06-15T23:30:00.000Z";
    expect(formatDayLabel(instant, "UTC")).toBe("Monday 15 June");
    expect(formatDayLabel(instant, "Europe/Amsterdam")).toBe("Tuesday 16 June");
  });

  it("resolves to the previous calendar day in a timezone behind UTC", () => {
    // 2026-06-15T02:00Z is already 15 June in UTC, but still 14 June in
    // America/Los_Angeles (UTC-7 in summer).
    const instant = "2026-06-15T02:00:00.000Z";
    expect(formatDayLabel(instant, "UTC")).toBe("Monday 15 June");
    expect(formatDayLabel(instant, "America/Los_Angeles")).toBe("Sunday 14 June");
  });
});
