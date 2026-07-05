// Minimal RFC 5545 iCalendar serializer for exporting a studio's schedule to a
// calendar subscription. Pure string building — no I/O.

export interface CalendarEvent {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string;
  location?: string;
}

export interface CalendarOptions {
  calendarName?: string;
  productId?: string;
  // Fixed "now" for DTSTAMP, so output is deterministic in tests.
  dtstamp?: string;
}

// Escape TEXT values per RFC 5545 §3.3.11: backslash, semicolon, comma, and
// newlines.
export function escapeICalText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

// "20260314T090000Z" — UTC basic format.
export function formatICalDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid ISO timestamp: ${iso}`);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

// Fold content lines to 75 octets with a leading space on continuations
// (RFC 5545 §3.1). Uses byte length so multibyte characters fold correctly.
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    // 74 to leave room for the continuation's leading space.
    const limit = chunks.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

function eventLines(event: CalendarEvent, dtstamp: string): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatICalDate(dtstamp)}`,
    `DTSTART:${formatICalDate(event.startsAt)}`,
    `DTEND:${formatICalDate(event.endsAt)}`,
    `SUMMARY:${escapeICalText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeICalText(event.location)}`);
  lines.push("END:VEVENT");
  return lines;
}

export function toICalendar(
  events: readonly CalendarEvent[],
  options: CalendarOptions = {},
): string {
  const dtstamp = options.dtstamp ?? new Date().toISOString();
  const productId = options.productId ?? "-//Studiobook//Schedule//EN";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${productId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(options.calendarName ?? "Studiobook")}`,
    ...events.flatMap((event) => eventLines(event, dtstamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n");
}
