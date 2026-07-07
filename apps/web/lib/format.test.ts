import { describe, expect, it } from "vitest";
import { formatDayLabel } from "./format";

describe("formatDayLabel", () => {
  it("produces 'Weekday D Month' format for a UTC midday instant", () => {
    expect(formatDayLabel("2026-03-14T12:00:00.000Z", "UTC")).toBe("Saturday 14 March");
  });

  it("rolls forward in Europe/Amsterdam near midnight UTC", () => {
    expect(formatDayLabel("2026-03-14T23:30:00.000Z", "Europe/Amsterdam")).toBe("Sunday 15 March");
  });

  it("stays on the prior day in America/New_York near midnight UTC", () => {
    expect(formatDayLabel("2026-03-14T23:30:00.000Z", "America/New_York")).toBe("Saturday 14 March");
  });

  it("produces the same output as studioTodayLabel for the same instant", () => {
    const iso = "2026-06-15T04:00:00.000Z";
    const tz = "Europe/Amsterdam";
    const label = formatDayLabel(iso, tz);
    expect(label).toBe("Monday 15 June");
  });
});