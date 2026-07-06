import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDayLabel, formatTime } from "./format";

// A fixed instant well away from any DST transition, used to assert the
// formatters key off the explicit IANA `timeZone` argument, not the host
// process's local timezone (e.g. a front-desk laptop set to US Eastern).
const ISO = "2026-06-15T10:30:00.000Z";
const STUDIO_TIMEZONE = "Europe/Amsterdam";

describe("format", () => {
  let originalTz: string | undefined;

  beforeEach(() => {
    originalTz = process.env.TZ;
  });

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("formatDayLabel is independent of the process's local TZ", () => {
    process.env.TZ = "America/New_York";
    const fromNewYork = formatDayLabel(ISO, STUDIO_TIMEZONE);

    process.env.TZ = "UTC";
    const fromUtc = formatDayLabel(ISO, STUDIO_TIMEZONE);

    expect(fromNewYork).toBe(fromUtc);
    expect(fromNewYork).toBe("Monday 15 June");
  });

  it("formatDate is independent of the process's local TZ", () => {
    process.env.TZ = "America/New_York";
    const fromNewYork = formatDate(ISO, STUDIO_TIMEZONE);

    process.env.TZ = "UTC";
    const fromUtc = formatDate(ISO, STUDIO_TIMEZONE);

    expect(fromNewYork).toBe(fromUtc);
  });

  it("formatTime is independent of the process's local TZ", () => {
    process.env.TZ = "America/New_York";
    const fromNewYork = formatTime(ISO, STUDIO_TIMEZONE);

    process.env.TZ = "UTC";
    const fromUtc = formatTime(ISO, STUDIO_TIMEZONE);

    expect(fromNewYork).toBe(fromUtc);
    expect(fromNewYork).toBe("12:30");
  });

  it("formatDateTime is independent of the process's local TZ", () => {
    process.env.TZ = "America/New_York";
    const fromNewYork = formatDateTime(ISO, STUDIO_TIMEZONE);

    process.env.TZ = "UTC";
    const fromUtc = formatDateTime(ISO, STUDIO_TIMEZONE);

    expect(fromNewYork).toBe(fromUtc);
  });
});
