import { describe, expect, it } from "vitest";
import { bookingsToCsv, escapeCsvField, invoicesToCsv, membersToCsv, toCsv } from "./csv";

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
    const csv = toCsv(
      [{ a: 1, b: "x,y" }],
      [
        { header: "A", value: (row) => row.a },
        { header: "B", value: (row) => row.b },
      ],
    );
    expect(csv).toBe('A,B\r\n1,"x,y"');
  });
});

describe("membersToCsv", () => {
  it("includes headers and renders a null phone as empty", () => {
    const csv = membersToCsv([
      {
        name: "Amara",
        email: "amara@example.com",
        phone: null,
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
      },
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
  it("uses the accounting export columns in order", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-01T08:00:00.000Z",
        className: "Morning Flow",
        memberName: "Rossi, Chiara",
        memberEmail: "chiara@example.com",
        status: "attended",
      },
    ]);

    expect(csv).toBe(
      "Starts,Class,Member,Email,Status\r\n2026-06-01T08:00:00.000Z,Morning Flow,\"Rossi, Chiara\",chiara@example.com,attended",
    );
  });

  it("escapes quotes and newlines with CRLF-delimited rows", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-01T08:00:00.000Z",
        className: 'Pilates "Power"',
        memberName: "Chiara\nRossi",
        memberEmail: "chiara@example.com",
        status: "booked",
      },
      {
        startsAt: "2026-06-02T08:00:00.000Z",
        className: "Yoga",
        memberName: "Amara",
        memberEmail: "amara@example.com",
        status: "attended",
      },
    ]);

    expect(csv).toContain('"Pilates ""Power"""');
    expect(csv).toContain('"Chiara\nRossi"');
    expect(csv).toContain("booked\r\n2026-06-02T08:00:00.000Z");
  });
});
