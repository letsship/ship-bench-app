import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDayLabel, formatTime } from "./format";

describe("formatDayLabel", () => {
  it("returns 'Weekday D Month' format", () => {
    const label = formatDayLabel("2026-06-15T12:00:00.000Z", "UTC");
    expect(label).toBe("Monday 15 June");
  });

  it("observes the supplied IANA timezone, not the machine local timezone", () => {
    // 2026-06-16T02:00:00Z is Tuesday 16 June in Amsterdam (UTC+2) but
    // Monday 15 June in Los Angeles (UTC-7).
    const instant = "2026-06-16T02:00:00.000Z";
    expect(formatDayLabel(instant, "Europe/Amsterdam")).toBe("Tuesday 16 June");
    expect(formatDayLabel(instant, "America/Los_Angeles")).toBe("Monday 15 June");
  });
});

describe("formatTime", () => {
  it("returns a short time in the requested timezone", () => {
    expect(formatTime("2026-06-15T14:30:00.000Z", "UTC")).toMatch(/14:30/);
  });
});

describe("formatDate", () => {
  it("returns a medium-length date in the requested timezone", () => {
    const result = formatDate("2026-06-15T12:00:00.000Z", "UTC");
    expect(result).toMatch(/15 Jun/);
  });
});

describe("formatDateTime", () => {
  it("returns a combined date and time in the requested timezone", () => {
    const result = formatDateTime("2026-06-15T14:30:00.000Z", "UTC");
    expect(result).toMatch(/15 Jun/);
    expect(result).toMatch(/14:30/);
  });
});
