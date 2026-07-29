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
  it("emits the header row in the spec column order", () => {
    const csv = bookingsToCsv([]);
    expect(csv).toBe("Starts,Class,Member,Email,Status");
  });

  it("renders a row in order with Starts as an ISO-8601 UTC timestamp", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-15T09:00:00.000Z",
        className: "Vinyasa Flow",
        memberName: "Amara Okafor",
        email: "amara@example.com",
        status: "attended",
      },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(row).toBe(
      "2026-06-15T09:00:00.000Z,Vinyasa Flow,Amara Okafor,amara@example.com,attended",
    );
  });

  it("normalizes a non-Z Starts to canonical ISO-8601 UTC", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-15T11:00:00+02:00",
        className: "Yin & Restore",
        memberName: "Bram de Vries",
        email: "bram@example.com",
        status: "booked",
      },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row.startsWith("2026-06-15T09:00:00.000Z,")).toBe(true);
  });

  it("quotes a member name containing a comma (RFC 4180)", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-15T09:00:00.000Z",
        className: "Reformer Pilates",
        memberName: "Rossi, Chiara",
        email: "chiara@example.com",
        status: "attended",
      },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toBe('2026-06-15T09:00:00.000Z,Reformer Pilates,"Rossi, Chiara",chiara@example.com,attended');
  });

  it("renders an unparseable Starts as empty instead of throwing", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "",
        className: "Hand Building",
        memberName: "Deshi Tan",
        email: "deshi@example.com",
        status: "booked",
      },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toBe(",Hand Building,Deshi Tan,deshi@example.com,booked");
  });
});
