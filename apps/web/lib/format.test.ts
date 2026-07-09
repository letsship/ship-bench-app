import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDayLabel, formatTime } from "./format";

describe("formatDayLabel across timezones", () => {
  // 23:30 UTC on 14 March is already 15 March in Amsterdam (CET, UTC+1) but
  // still 14 March in New York (EDT, UTC-4).
  const nearMidnightUtc = "2026-03-14T23:30:00.000Z";

  it("resolves the Amsterdam calendar day independently of UTC", () => {
    expect(formatDayLabel(nearMidnightUtc, "Europe/Amsterdam")).toBe("Sunday 15 March");
  });

  it("resolves the New York calendar day independently of UTC", () => {
    expect(formatDayLabel(nearMidnightUtc, "America/New_York")).toBe("Saturday 14 March");
  });

  it("resolves the UTC calendar day for reference", () => {
    expect(formatDayLabel(nearMidnightUtc, "UTC")).toBe("Saturday 14 March");
  });

  it("keeps the 'Weekday D Month' wording and format", () => {
    const label = formatDayLabel("2026-06-14T22:30:00.000Z", "Europe/Amsterdam");
    expect(label).toBe("Monday 15 June");
    expect(label).toMatch(/^[A-Z][a-z]+ \d{1,2} [A-Z][a-z]+$/);
  });
});

describe("other formatters stay timezone-aware", () => {
  const iso = "2026-06-14T22:30:00.000Z";

  it("formatTime respects the given timezone", () => {
    expect(formatTime(iso, "Europe/Amsterdam")).toBe("00:30");
    expect(formatTime(iso, "UTC")).toBe("22:30");
  });

  it("formatDate respects the given timezone", () => {
    expect(formatDate(iso, "Europe/Amsterdam")).toBe("15 Jun 2026");
    expect(formatDate(iso, "UTC")).toBe("14 Jun 2026");
  });

  it("formatDateTime respects the given timezone", () => {
    expect(formatDateTime(iso, "Europe/Amsterdam")).toBe("15 Jun 2026, 00:30");
    expect(formatDateTime(iso, "UTC")).toBe("14 Jun 2026, 22:30");
  });
});
