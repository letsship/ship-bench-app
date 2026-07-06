import { describe, expect, it } from "vitest";
import { formatDayLabel } from "./format";

describe("formatDayLabel", () => {
  it("formats the day in the studio timezone with weekday day month wording", () => {
    const iso = "2020-06-14T22:30:00.000Z";

    expect(formatDayLabel(iso, "Europe/Amsterdam")).toBe("Monday 15 June");
    expect(formatDayLabel(iso, "UTC")).toBe("Sunday 14 June");
  });
});
