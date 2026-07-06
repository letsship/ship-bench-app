import { describe, expect, it } from "vitest";
import { formatDayLabel } from "./format";

// The dashboard header's "Today at the studio" subtitle is formatted from a
// single shared `nowIso` instant in the studio's configured IANA timezone.
// These tests mirror the conventions in `domain/dates.test.ts`: pin an instant
// near a UTC midnight boundary and assert the rendered calendar day follows the
// studio's timezone — not UTC and not the process/runner local timezone — and
// that the human-readable wording/format ("Weekday D Month") is preserved.

describe("formatDayLabel across timezones", () => {
  const nearMidnightUtc = "2026-06-14T23:30:00.000Z";

  it("rolls forward to the next calendar day in Europe/Amsterdam (CEST, UTC+2)", () => {
    // 23:30Z on the 14th -> 01:30 on the 15th in Amsterdam.
    expect(formatDayLabel(nearMidnightUtc, "Europe/Amsterdam")).toBe("Monday 15 June");
  });

  it("stays on the prior calendar day in America/Los_Angeles (PDT, UTC-7)", () => {
    // 23:30Z on the 14th -> 16:30 on the 14th in Los Angeles.
    expect(formatDayLabel(nearMidnightUtc, "America/Los_Angeles")).toBe("Sunday 14 June");
  });

  it("matches UTC for a mid-day instant", () => {
    expect(formatDayLabel("2026-06-15T12:00:00.000Z", "UTC")).toBe("Monday 15 June");
  });

  it("is independent of the runner's process timezone", () => {
    // Whatever the CI runner's TZ is, an instant that is 01:30 on the 15th in
    // Amsterdam must always render as the 15th there, and 16:30 on the 14th in
    // Los Angeles must always render as the 14th there.
    const amsterdam = formatDayLabel(nearMidnightUtc, "Europe/Amsterdam");
    const losAngeles = formatDayLabel(nearMidnightUtc, "America/Los_Angeles");
    expect(amsterdam).not.toBe(losAngeles);
    expect(amsterdam).toBe("Monday 15 June");
    expect(losAngeles).toBe("Sunday 14 June");
  });

  it("preserves the 'Weekday D Month' wording across a month boundary", () => {
    // 2026-06-30T23:30:00Z -> 01:30 on 1 July in Amsterdam.
    expect(formatDayLabel("2026-06-30T23:30:00.000Z", "Europe/Amsterdam")).toBe(
      "Wednesday 1 July",
    );
  });
});
