import { describe, expect, it } from "vitest";
import { bookingsToCsv } from "@/lib/domain/csv";

describe("bookings CSV export", () => {
  it("produces a CSV with the correct column headers", () => {
    const bookings = [
      {
        startsAt: "2026-03-15T10:00:00Z",
        className: "Pilates",
        memberName: "Amara",
        memberEmail: "amara@example.com",
        status: "confirmed",
      },
    ];
    const csv = bookingsToCsv(bookings);
    const [header] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
  });

  it("includes all booking data in the correct order", () => {
    const bookings = [
      {
        startsAt: "2026-03-15T10:00:00Z",
        className: "Pilates",
        memberName: "Amara",
        memberEmail: "amara@example.com",
        status: "confirmed",
      },
    ];
    const csv = bookingsToCsv(bookings);
    const [, row] = csv.split("\r\n");
    expect(row).toBe("2026-03-15T10:00:00Z,Pilates,Amara,amara@example.com,confirmed");
  });

  it("quotes names with commas as per RFC 4180", () => {
    const bookings = [
      {
        startsAt: "2026-03-15T10:00:00Z",
        className: "Yoga",
        memberName: "Rossi, Chiara",
        memberEmail: "chiara@example.com",
        status: "confirmed",
      },
    ];
    const csv = bookingsToCsv(bookings);
    const [, row] = csv.split("\r\n");
    expect(row).toContain('"Rossi, Chiara"');
  });

  it("handles empty booking lists", () => {
    const csv = bookingsToCsv([]);
    expect(csv).toBe("Starts,Class,Member,Email,Status");
  });
});
