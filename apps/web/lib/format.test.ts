import { describe, expect, it } from "vitest";
import { formatDayLabel } from "./format";

describe("formatDayLabel across timezones", () => {
  const nearMidnightUtc = "2026-03-14T23:30:00.000Z";

  it("rolls forward in Europe/Amsterdam (UTC+1)", () => {
    expect(formatDayLabel(nearMidnightUtc, "Europe/Amsterdam")).toBe("Sunday 15 March");
  });

  it("stays on the prior day in America/Los_Angeles (PDT, UTC-7)", () => {
    expect(formatDayLabel(nearMidnightUtc, "America/Los_Angeles")).toBe("Saturday 14 March");
  });

  it("stays on the prior day in Pacific/Honolulu (UTC-10)", () => {
    expect(formatDayLabel(nearMidnightUtc, "Pacific/Honolulu")).toBe("Saturday 14 March");
  });

  it("matches UTC for the same instant", () => {
    expect(formatDayLabel(nearMidnightUtc, "UTC")).toBe("Saturday 14 March");
  });
});
