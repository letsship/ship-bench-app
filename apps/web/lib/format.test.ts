import { describe, expect, it } from "vitest";
import { formatDate, formatDayLabel, formatTime } from "./format";

describe("formatDayLabel", () => {
  const earlyAmsterdamMorning = "2026-06-14T22:30:00.000Z";

  it("formats the studio calendar day using the provided IANA timezone", () => {
    expect(formatDayLabel(earlyAmsterdamMorning, "Europe/Amsterdam")).toBe("Monday 15 June");
  });

  it("does not follow a visitor timezone that is still on the prior day", () => {
    expect(formatDayLabel(earlyAmsterdamMorning, "America/New_York")).toBe("Sunday 14 June");
    expect(formatDayLabel(earlyAmsterdamMorning, "America/Los_Angeles")).toBe("Sunday 14 June");
  });
});

describe("formatDate and formatTime", () => {
  const earlyAmsterdamMorning = "2026-06-14T22:30:00.000Z";

  it("formats date and time in the supplied studio timezone", () => {
    expect(formatDate(earlyAmsterdamMorning, "Europe/Amsterdam")).toBe("15 Jun 2026");
    expect(formatTime(earlyAmsterdamMorning, "Europe/Amsterdam")).toBe("00:30");
  });
});
