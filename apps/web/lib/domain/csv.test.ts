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
  it("emits the header in the required column order", () => {
    expect(bookingsToCsv([])).toBe("Starts,Class,Member,Email,Status");
  });

  it("renders Starts as the verbatim ISO-8601 UTC timestamp", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-15T12:00:00.000Z",
        className: "Vinyasa Flow",
        memberName: "Amara Okafor",
        email: "amara@example.com",
        status: "booked",
      },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    expect(row).toBe("2026-06-15T12:00:00.000Z,Vinyasa Flow,Amara Okafor,amara@example.com,booked");
  });

  it("keeps a comma in a member name as a single quoted column", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-15T12:00:00.000Z",
        className: "Yin & Restore",
        memberName: "Rossi, Chiara",
        email: "chiara@example.com",
        status: "attended",
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe(
      '2026-06-15T12:00:00.000Z,Yin & Restore,"Rossi, Chiara",chiara@example.com,attended',
    );
  });

  it("doubles embedded quotes and joins rows with CRLF", () => {
    const csv = bookingsToCsv([
      {
        startsAt: "2026-06-01T08:00:00.000Z",
        className: 'Class "A"',
        memberName: 'He said "hi"',
        email: "a@e.co",
        status: "booked",
      },
      {
        startsAt: "2026-06-02T08:00:00.000Z",
        className: "Class B",
        memberName: "Bob",
        email: "b@e.co",
        status: "attended",
      },
    ]);
    expect(csv).toBe(
      "Starts,Class,Member,Email,Status\r\n" +
        '2026-06-01T08:00:00.000Z,"Class ""A""","He said ""hi""",a@e.co,booked\r\n' +
        "2026-06-02T08:00:00.000Z,Class B,Bob,b@e.co,attended",
    );
  });
});
