import { describe, expect, it } from "vitest";
import { formatDayLabel } from "./format";

describe("formatDayLabel", () => {
  it("produces the exact 'Weekday D Month' wording", () => {
    expect(formatDayLabel("2026-06-15T10:00:00.000Z", "UTC")).toBe("Monday 15 June");
  });

  it("rolls forward near midnight in Europe/Amsterdam", () => {
    expect(formatDayLabel("2026-03-14T23:30:00.000Z", "Europe/Amsterdam")).toBe(
      "Sunday 15 March",
    );
  });

  it("stays on the prior day in America/Los_Angeles", () => {
    expect(formatDayLabel("2026-03-14T23:30:00.000Z", "America/Los_Angeles")).toBe(
      "Saturday 14 March",
    );
  });
});
