import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDayLabel, formatTime } from "./format";

// Europe/Amsterdam observes CEST (UTC+2) in summer / CET (UTC+1) in winter.
const AMSTERDAM = "Europe/Amsterdam";
// America/New_York observes EDT (UTC-4) in summer / EST (UTC-5) in winter.
const NEW_YORK = "America/New_York";

describe("formatDayLabel", () => {
  it("keeps the studio wording and ordering (weekday day month)", () => {
    expect(formatDayLabel("2026-06-15T10:00:00.000Z", AMSTERDAM)).toBe("Monday 15 June");
  });

  it("agrees with UTC at a midday instant regardless of zone", () => {
    const iso = "2026-06-15T12:00:00.000Z";
    expect(formatDayLabel(iso, AMSTERDAM)).toBe(formatDayLabel(iso, "UTC"));
    expect(formatDayLabel(iso, NEW_YORK)).toBe(formatDayLabel(iso, "UTC"));
  });

  it("rolls to the next calendar day in Amsterdam near UTC midnight", () => {
    // 23:30 UTC on the 14th is 01:30 on the 15th in Amsterdam (CEST, UTC+2).
    expect(formatDayLabel("2026-06-14T23:30:00.000Z", AMSTERDAM)).toBe("Monday 15 June");
  });

  it("stays on the prior calendar day in New York near UTC midnight", () => {
    // 23:30 UTC on the 14th is 19:30 on the 14th in New York (EDT, UTC-4).
    expect(formatDayLabel("2026-06-14T23:30:00.000Z", NEW_YORK)).toBe("Sunday 14 June");
  });

  it("observes different calendar days across zones at the same instant", () => {
    // 04:00 UTC on the 15th is 06:00 Amsterdam (15th) but 00:00 New York (15th,
    // just after midnight) — both on the 15th here, so pick a stricter split:
    // 03:00 UTC on the 15th is 05:00 Amsterdam (15th) and 23:00 New York on the
    // 14th, demonstrating the same instant maps to different days.
    expect(formatDayLabel("2026-06-15T03:00:00.000Z", AMSTERDAM)).toBe("Monday 15 June");
    expect(formatDayLabel("2026-06-15T03:00:00.000Z", NEW_YORK)).toBe("Sunday 14 June");
  });

  it("handles a year-boundary midnight in Amsterdam", () => {
    // 2026-01-01T00:30:00Z is 01:30 on 2026-01-01 in Amsterdam (CET, UTC+1).
    expect(formatDayLabel("2026-01-01T00:30:00.000Z", AMSTERDAM)).toBe("Thursday 1 January");
  });
});

describe("formatDate", () => {
  it("formats a medium date in the studio timezone", () => {
    expect(formatDate("2026-06-15T10:00:00.000Z", AMSTERDAM)).toBe("15 Jun 2026");
  });

  it("shifts the calendar day near UTC midnight", () => {
    expect(formatDate("2026-06-14T23:30:00.000Z", AMSTERDAM)).toBe("15 Jun 2026");
    expect(formatDate("2026-06-14T23:30:00.000Z", NEW_YORK)).toBe("14 Jun 2026");
  });
});

describe("formatDateTime", () => {
  it("combines medium date and short time in the studio timezone", () => {
    expect(formatDateTime("2026-06-15T10:00:00.000Z", AMSTERDAM)).toBe("15 Jun 2026, 12:00");
  });

  it("renders differently across zones for the same instant", () => {
    // 2026-06-15T03:00:00Z: Amsterdam 15 Jun 2026, 05:00; New York 14 Jun 2026, 23:00.
    expect(formatDateTime("2026-06-15T03:00:00.000Z", AMSTERDAM)).toBe("15 Jun 2026, 05:00");
    expect(formatDateTime("2026-06-15T03:00:00.000Z", NEW_YORK)).toBe("14 Jun 2026, 23:00");
  });
});

describe("formatTime", () => {
  it("formats a short time in the studio timezone", () => {
    expect(formatTime("2026-06-15T10:00:00.000Z", AMSTERDAM)).toBe("12:00");
  });

  it("does not roll the day but shifts the wall-clock hour across zones", () => {
    expect(formatTime("2026-06-15T03:00:00.000Z", AMSTERDAM)).toBe("05:00");
    expect(formatTime("2026-06-15T03:00:00.000Z", NEW_YORK)).toBe("23:00");
  });
});
