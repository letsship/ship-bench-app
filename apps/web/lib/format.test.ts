import { describe, expect, it } from "vitest";
import { formatDayLabel, formatDate, formatDateTime, formatTime } from "./format";

describe("formatDayLabel across timezones", () => {
  // 2026-03-14T23:30:00Z: already 00:30 on March 15 in Amsterdam (UTC+1),
  // but still 16:30 on March 14 in Los_Angeles (PDT, UTC-7).
  const nearAmsterdamMidnightUtc = "2026-03-14T23:30:00.000Z";

  it("rolls forward to the next day in Europe/Amsterdam (UTC+1)", () => {
    expect(formatDayLabel(nearAmsterdamMidnightUtc, "Europe/Amsterdam")).toBe(
      "Sunday 15 March",
    );
  });

  it("stays on the prior day in America/Los_Angeles (PDT, UTC-7)", () => {
    expect(formatDayLabel(nearAmsterdamMidnightUtc, "America/Los_Angeles")).toBe(
      "Saturday 14 March",
    );
  });

  it("matches UTC for a mid-day instant", () => {
    expect(formatDayLabel("2026-03-14T12:00:00.000Z", "UTC")).toBe(
      "Saturday 14 March",
    );
  });

  it("returns the weekday/day/month wording (no year, no time)", () => {
    const label = formatDayLabel("2026-06-15T09:00:00.000Z", "Europe/Amsterdam");
    expect(label).toMatch(/^[A-Z][a-z]+ [0-9]{1,2} [A-Z][a-z]+$/);
    expect(label).toBe("Monday 15 June");
  });
});

describe("formatTime / formatDateTime / formatDate", () => {
  it("formats a time in the studio timezone", () => {
    // 12:00 UTC is 14:00 Amsterdam in June (CEST, UTC+2).
    expect(formatTime("2026-06-15T12:00:00.000Z", "Europe/Amsterdam")).toBe(
      "14:00",
    );
  });

  it("formats a date-time respecting the timezone", () => {
    expect(
      formatDateTime("2026-06-15T22:30:00.000Z", "Europe/Amsterdam"),
    ).toBe("16 Jun 2026, 00:30");
  });

  it("formats a short date respecting the timezone", () => {
    expect(formatDate("2026-06-15T22:30:00.000Z", "Europe/Amsterdam")).toBe(
      "16 Jun 2026",
    );
  });
});
