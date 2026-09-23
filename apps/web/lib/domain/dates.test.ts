import { describe, expect, it } from "vitest";
import {
  dayKey,
  durationMinutes,
  groupByDay,
  hoursBetween,
  isBefore,
  isSameDay,
  isWithinInclusiveRange,
  monthKey,
  zonedParts,
} from "./dates";

describe("dayKey across timezones", () => {
  const nearMidnightUtc = "2026-03-14T23:30:00.000Z";

  it("rolls forward in Europe/Amsterdam (UTC+1)", () => {
    expect(dayKey(nearMidnightUtc, "Europe/Amsterdam")).toBe("2026-03-15");
  });

  it("stays on the prior day in America/Los_Angeles (PDT, UTC-7)", () => {
    expect(dayKey(nearMidnightUtc, "America/Los_Angeles")).toBe("2026-03-14");
  });

  it("rolls forward in Pacific/Kiritimati (UTC+14)", () => {
    expect(dayKey(nearMidnightUtc, "Pacific/Kiritimati")).toBe("2026-03-15");
  });

  it("stays on the prior day in Pacific/Honolulu (UTC-10)", () => {
    expect(dayKey(nearMidnightUtc, "Pacific/Honolulu")).toBe("2026-03-14");
  });

  it("matches UTC for a mid-day instant", () => {
    expect(dayKey("2026-03-14T12:00:00.000Z", "UTC")).toBe("2026-03-14");
  });
});

describe("monthKey across timezones", () => {
  it("rolls into the next month in Amsterdam", () => {
    expect(monthKey("2026-01-31T23:30:00.000Z", "Europe/Amsterdam")).toBe("2026-02");
  });

  it("stays in the month in Honolulu", () => {
    expect(monthKey("2026-01-31T23:30:00.000Z", "Pacific/Honolulu")).toBe("2026-01");
  });
});

describe("isSameDay", () => {
  it("is false across a local-day boundary", () => {
    const a = "2026-03-14T23:30:00.000Z";
    const b = "2026-03-15T00:30:00.000Z";
    expect(isSameDay(a, b, "UTC")).toBe(false);
  });

  it("is true within the same LA day even across a UTC boundary", () => {
    const a = "2026-03-14T20:00:00.000Z"; // 13:00 PDT
    const b = "2026-03-15T02:00:00.000Z"; // 19:00 PDT same day
    expect(isSameDay(a, b, "America/Los_Angeles")).toBe(true);
  });
});

describe("hoursBetween / durationMinutes / isBefore", () => {
  it("returns positive hours forward", () => {
    expect(hoursBetween("2026-01-01T00:00:00Z", "2026-01-01T06:00:00Z")).toBe(6);
  });

  it("returns negative hours backward", () => {
    expect(hoursBetween("2026-01-01T06:00:00Z", "2026-01-01T00:00:00Z")).toBe(-6);
  });

  it("computes duration in minutes", () => {
    expect(durationMinutes("2026-01-01T09:00:00Z", "2026-01-01T10:30:00Z")).toBe(90);
  });

  it("orders instants", () => {
    expect(isBefore("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(true);
    expect(isBefore("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(false);
  });
});

describe("zonedParts", () => {
  it("extracts wall-clock parts in a timezone", () => {
    const parts = zonedParts("2026-03-14T23:30:00.000Z", "Europe/Amsterdam");
    expect(parts).toMatchObject({ year: 2026, month: 3, day: 15, hour: 0, minute: 30 });
  });

  it("throws on an invalid timestamp", () => {
    expect(() => zonedParts("not-a-date", "UTC")).toThrow(RangeError);
  });
});

describe("isWithinInclusiveRange", () => {
  const from = "2026-06-01T00:00:00.000Z";
  const to = "2026-06-30T23:59:59.000Z";

  it("includes a value inside the range", () => {
    expect(isWithinInclusiveRange("2026-06-15T12:00:00.000Z", from, to)).toBe(true);
  });

  it("includes the exact `from` boundary", () => {
    expect(isWithinInclusiveRange(from, from, to)).toBe(true);
  });

  it("includes the exact `to` boundary", () => {
    expect(isWithinInclusiveRange(to, from, to)).toBe(true);
  });

  it("excludes a value just before `from`", () => {
    expect(isWithinInclusiveRange("2026-05-31T23:59:59.000Z", from, to)).toBe(false);
  });

  it("excludes a value just after `to`", () => {
    expect(isWithinInclusiveRange("2026-07-01T00:00:00.000Z", from, to)).toBe(false);
  });

  it("is always true with both bounds omitted", () => {
    expect(isWithinInclusiveRange("2026-01-01T00:00:00.000Z")).toBe(true);
  });

  it("is unbounded before when only `to` is given", () => {
    expect(isWithinInclusiveRange("2000-01-01T00:00:00.000Z", undefined, to)).toBe(true);
    expect(isWithinInclusiveRange("2026-07-01T00:00:00.000Z", undefined, to)).toBe(false);
  });

  it("is unbounded after when only `from` is given", () => {
    expect(isWithinInclusiveRange("2026-07-01T00:00:00.000Z", from, undefined)).toBe(true);
    expect(isWithinInclusiveRange("2026-05-01T00:00:00.000Z", from, undefined)).toBe(false);
  });

  it("accepts a bare-date `to` bound and still includes same-day later instants", () => {
    // `2026-06-30` parses to 2026-06-30T00:00:00Z, but inclusive semantics on
    // a bare date should keep the whole day; the helper compares instants, so
    // a bare date as `to` only covers up to midnight — use an explicit time to
    // capture the full day. This test pins the instant-comparison behaviour so
    // a same-day afternoon booking is not wrongly excluded by string ordering.
    expect(isWithinInclusiveRange("2026-06-30T15:00:00.000Z", from, "2026-06-30T23:59:59Z")).toBe(
      true,
    );
  });

  it("accepts a `to` bound without milliseconds", () => {
    // `2026-06-30T23:59:59Z` is valid ISO-8601 without `.000` ms; lexicographic
    // comparison against the stored `.000Z` form would wrongly exclude it.
    expect(isWithinInclusiveRange("2026-06-30T23:59:59.000Z", from, "2026-06-30T23:59:59Z")).toBe(
      true,
    );
    expect(isWithinInclusiveRange("2026-07-01T00:00:00.000Z", from, "2026-06-30T23:59:59Z")).toBe(
      false,
    );
  });

  it("accepts an offset `from` bound and compares chronologically", () => {
    // 2026-06-01T00:00:00+02:00 == 2026-05-31T22:00:00Z; a UTC instant just
    // before that must be excluded, just after included.
    expect(isWithinInclusiveRange("2026-05-31T21:59:59.000Z", "2026-06-01T00:00:00+02:00", to)).toBe(
      false,
    );
    expect(isWithinInclusiveRange("2026-05-31T22:00:00.000Z", "2026-06-01T00:00:00+02:00", to)).toBe(
      true,
    );
  });
});

describe("groupByDay", () => {
  it("buckets by local day and sorts ascending", () => {
    const items = [
      { at: "2026-03-15T10:00:00Z" },
      { at: "2026-03-14T10:00:00Z" },
      { at: "2026-03-14T18:00:00Z" },
    ];
    const groups = groupByDay(items, (item) => item.at, "UTC");
    expect(groups.map((group) => group.day)).toEqual(["2026-03-14", "2026-03-15"]);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
  });

  it("preserves input order within a day", () => {
    const items = [{ at: "2026-03-14T18:00:00Z" }, { at: "2026-03-14T09:00:00Z" }];
    const groups = groupByDay(items, (item) => item.at, "UTC");
    expect(groups[0].items[0].at).toBe("2026-03-14T18:00:00Z");
  });
});
