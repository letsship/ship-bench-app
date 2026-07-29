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

describe("bookingsToCsv", () => {
  it("emits the exact header and column order", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-10T08:00:00.000Z",
        className: "Vinyasa Flow",
        memberName: "Amara Okafor",
        email: "amara@example.com",
        status: "attended",
      },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(row).toBe(
      "2026-06-10T08:00:00.000Z,Vinyasa Flow,Amara Okafor,amara@example.com,attended",
    );
  });

  it("keeps a member named 'Rossi, Chiara' a single quoted column", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-10T08:00:00.000Z",
        className: "Yin & Restore",
        memberName: "Rossi, Chiara",
        email: "chiara@example.com",
        status: "booked",
      },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toBe(
      '2026-06-10T08:00:00.000Z,Yin & Restore,"Rossi, Chiara",chiara@example.com,booked',
    );
  });

  it("doubles embedded quotes per RFC 4180", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-10T08:00:00.000Z",
        className: 'Pottery "Intro"',
        memberName: "Bram",
        email: "bram@example.com",
        status: "booked",
      },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain('"Pottery ""Intro"""');
  });

  it("normalises Starts to a UTC ISO-8601 timestamp", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-10T10:00:00+02:00",
        className: "Yoga",
        memberName: "Bram",
        email: "bram@example.com",
        status: "booked",
      },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row.startsWith("2026-06-10T08:00:00.000Z,")).toBe(true);
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
