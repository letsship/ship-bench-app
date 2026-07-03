import { describe, expect, it } from "vitest";
import { escapeICalText, foldLine, formatICalDate, toICalendar } from "./ical";

describe("escapeICalText", () => {
  it("escapes backslash, semicolon, comma, and newline", () => {
    expect(escapeICalText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });
});

describe("formatICalDate", () => {
  it("renders UTC basic format", () => {
    expect(formatICalDate("2026-03-14T09:00:00.000Z")).toBe("20260314T090000Z");
  });

  it("throws on an invalid timestamp", () => {
    expect(() => formatICalDate("nope")).toThrow(RangeError);
  });
});

describe("foldLine", () => {
  it("leaves short lines unchanged", () => {
    expect(foldLine("SHORT:value")).toBe("SHORT:value");
  });

  it("folds long lines with CRLF and a leading space", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldLine(line);
    expect(folded).toContain("\r\n ");
    for (const physical of folded.split("\r\n")) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    }
  });

  it("counts multibyte characters as bytes", () => {
    const line = "SUMMARY:" + "é".repeat(50); // 2 bytes each
    const folded = foldLine(line);
    for (const physical of folded.split("\r\n")) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("toICalendar", () => {
  const event = {
    uid: "session-1@studiobook",
    title: "Vinyasa Flow",
    startsAt: "2026-03-14T09:00:00.000Z",
    endsAt: "2026-03-14T10:00:00.000Z",
    description: "Instructor: Noor",
    location: "Riverbank Movement",
  };

  it("wraps events in a VCALENDAR with one VEVENT each", () => {
    const ics = toICalendar([event], { dtstamp: "2026-01-01T00:00:00.000Z" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:session-1@studiobook");
    expect(ics).toContain("DTSTART:20260314T090000Z");
    expect(ics).toContain("DTEND:20260314T100000Z");
    expect(ics).toContain("SUMMARY:Vinyasa Flow");
    expect(ics).toContain("DTSTAMP:20260101T000000Z");
  });

  it("uses CRLF line endings", () => {
    const ics = toICalendar([event], { dtstamp: "2026-01-01T00:00:00.000Z" });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });

  it("handles an empty event list", () => {
    const ics = toICalendar([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
