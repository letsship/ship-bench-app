import { describe, expect, it } from "vitest";
import { formatDayLabel } from "./format";

describe("formatDayLabel", () => {
  it("resolves the correct calendar day in the studio's timezone", () => {
    const amsterdam = formatDayLabel(
      "2026-06-15T02:00:00.000Z",
      "Europe/Amsterdam",
    );
    expect(amsterdam).toBe("Monday 15 June");

    const losAngeles = formatDayLabel(
      "2026-06-15T02:00:00.000Z",
      "America/Los_Angeles",
    );
    expect(losAngeles).toBe("Sunday 14 June");
  });

  it("uses the 'Weekday D Month' format", () => {
    const result = formatDayLabel("2026-01-01T12:00:00.000Z", "UTC");
    expect(result).toBe("Thursday 1 January");
  });
});
