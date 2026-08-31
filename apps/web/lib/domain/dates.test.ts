import { describe, expect, it } from "vitest";
import {
  addHours,
  dayKey,
  durationMinutes,
  groupByDay,
  hoursBetween,
  isBefore,
  isSameDay,
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

describe("hoursBetween / durationMinutes / isBefore / addHours", () => {
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

  it("addHours advances the instant by the given hours", () => {
    expect(addHours("2026-01-01T00:00:00.000Z", 24)).toBe("2026-01-02T00:00:00.000Z");
    expect(addHours("2026-01-01T00:00:00.000Z", 1)).toBe("2026-01-01T01:00:00.000Z");
  });

  it("addHours accepts a negative offset", () => {
    expect(addHours("2026-01-02T00:00:00.000Z", -24)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("addHours returns a valid ISO string", () => {
    const result = addHours("2026-01-01T00:00:00.000Z", 6);
    expect(() => new Date(result).toISOString()).not.toThrow();
    expect(new Date(result).toISOString()).toBe(result);
  });

  it("addHours throws on an invalid timestamp", () => {
    expect(() => addHours("not-a-date", 1)).toThrow(RangeError);
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
