import {
  bookingsToCsv,
  escapeCsvField,
  invoicesToCsv,
  membersToCsv,
  toCsv,
} from "./csv";

import { describe, expect, it } from "vitest";

describe("escapeCsvField", () => {
  it("leaves plain values untouched", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField(42)).toBe("42");
  });

  it("quotes values containing a comma", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("quotes values containing a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("emits a header and CRLF-joined rows with escaping", () => {
    const csv = toCsv([{ a: 1, b: "x,y" }], [
      { header: "A", value: (row) => row.a },
      { header: "B", value: (row) => row.b },
    ]);
    expect(csv).toBe('A,B\r\n1,"x,y"');
  });
});

describe("membersToCsv", () => {
  it("includes headers and renders a null phone as empty", () => {
    const csv = membersToCsv([
      { name: "Amara", email: "amara@example.com", phone: null, status: "active", createdAt: "2026-01-01T00:00:00Z" },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("Name,Email,Phone,Status,Joined");
    expect(row).toBe("Amara,amara@example.com,,active,2026-01-01T00:00:00Z");
  });
});

describe("invoicesToCsv", () => {
  it("formats the total as major units", () => {
    const csv = invoicesToCsv([
      {
        number: "INV-2026-0001",
        memberName: "Bram",
        status: "paid",
        issuedAt: "2026-01-01T00:00:00Z",
        totalCents: 12345,
        currency: "EUR",
      },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain("123.45");
    expect(row).toContain("INV-2026-0001");
  });
});

describe("bookingsToCsv", () => {
  it("emits the correct header", () => {
    const csv = bookingsToCsv([
      { startsAt: "2026-06-15T09:00:00.000Z", className: "Vinyasa", memberName: "Alice", email: "alice@e.co", status: "booked" },
    ]);
    const [header] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("quotes a member name containing a comma", () => {
    const csv = bookingsToCsv([
      { startsAt: "2026-06-15T09:00:00.000Z", className: "Vinyasa", memberName: "Rossi, Chiara", email: "rossi@e.co", status: "booked" },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toMatch(/"Rossi, Chiara"/);
  });

  it("passes startsAt through as the Starts column", () => {
    const csv = bookingsToCsv([
      { startsAt: "2026-06-30T23:59:59.000Z", className: "Yoga", memberName: "Bob", email: "bob@e.co", status: "cancelled" },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toMatch(/^2026-06-30T23:59:59\.000Z/);
  });
});
