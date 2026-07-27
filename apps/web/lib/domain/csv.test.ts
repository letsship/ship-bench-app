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
  it("has the correct header columns in order", () => {
    const csv = bookingsToCsv([]);
    const header = csv.split("\r\n")[0];
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("keeps a member name with a comma as a single quoted column", () => {
    const csv = bookingsToCsv([
      {
        starts: "2026-06-15T10:00:00Z",
        className: "Yoga",
        memberName: "Rossi, Chiara",
        email: "chiara@example.com",
        status: "booked",
      },
    ]);
    const [, row] = csv.split("\r\n");
    expect(row).toContain('"Rossi, Chiara"');
  });

  it("doubles embedded double quotes", () => {
    const csv = bookingsToCsv([
      {
        starts: "2026-06-15T10:00:00Z",
        className: 'Yoga "Advanced"',
        memberName: "Alice",
        email: "alice@example.com",
        status: "booked",
      },
    ]);
    const [, row] = csv.split("\r\n");
    expect(row).toContain('"Yoga ""Advanced"""');
  });

  it("normalizes starts to ISO-8601 UTC", () => {
    const csv = bookingsToCsv([
      {
        starts: "2026-06-15T10:00:00Z",
        className: "Yoga",
        memberName: "Bob",
        email: "bob@example.com",
        status: "booked",
      },
    ]);
    const [, row] = csv.split("\r\n");
    expect(row).toContain("2026-06-15T10:00:00.000Z");
  });

  it("returns just the header for empty rows", () => {
    const csv = bookingsToCsv([]);
    expect(csv).toBe("Starts,Class,Member,Email,Status");
  });
});
