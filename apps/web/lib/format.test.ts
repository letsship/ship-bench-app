import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDayLabel, formatTime } from "./format";

// A fixed instant that straddles calendar-day boundaries across timezones.
// 2026-07-07T01:00:00Z = 2026-07-07 03:00 CEST (Europe/Amsterdam, UTC+2)
//                      = 2026-07-06 21:00 EDT  (America/New_York, UTC-4)
//                      = 2026-07-07 09:00 CST  (Asia/Shanghai, UTC+8)
const FIXED_ISO = "2026-07-07T01:00:00.000Z";

describe("formatDayLabel", () => {
  it("returns weekday, day, and month for Europe/Amsterdam", () => {
    // 2026-07-07 is a Tuesday.
    expect(formatDayLabel(FIXED_ISO, "Europe/Amsterdam")).toBe("Tuesday 7 July");
  });

  it("returns a different calendar day for America/New_York", () => {
    // 2026-07-07 01:00 UTC = 2026-07-06 21:00 EDT → Monday 6 July.
    expect(formatDayLabel(FIXED_ISO, "America/New_York")).toBe("Monday 6 July");
  });

  it("returns the same UTC day for Asia/Shanghai", () => {
    // 2026-07-07 01:00 UTC = 2026-07-07 09:00 CST → still 7 July.
    expect(formatDayLabel(FIXED_ISO, "Asia/Shanghai")).toBe("Tuesday 7 July");
  });

  it("matches the 'Weekday D Month' pattern always", () => {
    const result = formatDayLabel(FIXED_ISO, "Europe/Amsterdam");
    expect(result).toMatch(/^[A-Z][a-z]+ \d{1,2} [A-Z][a-z]+$/);
  });
});

describe("formatTime", () => {
  it("formats time in the given timezone", () => {
    // 01:00 UTC = 03:00 CEST
    expect(formatTime(FIXED_ISO, "Europe/Amsterdam")).toBe("03:00");
    // 01:00 UTC = 21:00 EDT (previous day)
    expect(formatTime(FIXED_ISO, "America/New_York")).toBe("21:00");
  });
});

describe("formatDate", () => {
  it("formats a medium date in the given timezone", () => {
    expect(formatDate(FIXED_ISO, "Europe/Amsterdam")).toBe("7 Jul 2026");
    expect(formatDate(FIXED_ISO, "America/New_York")).toBe("6 Jul 2026");
  });
});

describe("formatDateTime", () => {
  it("formats date + time in the given timezone", () => {
    expect(formatDateTime(FIXED_ISO, "Europe/Amsterdam")).toBe("7 Jul 2026, 03:00");
    expect(formatDateTime(FIXED_ISO, "America/New_York")).toBe("6 Jul 2026, 21:00");
  });
});