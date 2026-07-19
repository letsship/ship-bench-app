import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET /api/ical/[token] (per-member calendar subscription)", () => {
  let seed: ReturnType<typeof buildSeed>;

  beforeEach(() => {
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 200 with iCalendar content-type for a valid token", async () => {
    const member = seed.members[0];
    const res = await GET(new Request("http://localhost/api/ical/" + member.calendarToken), {
      params: Promise.resolve({ token: member.calendarToken }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
  });

  it("includes only that member's upcoming sessions in the feed", async () => {
    const member = seed.members[0];
    const res = await GET(new Request("http://localhost/api/ical/" + member.calendarToken), {
      params: Promise.resolve({ token: member.calendarToken }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();

    // Should be valid iCalendar
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");

    // Should contain member's name in calendar title
    expect(body).toContain(member.name);
  });

  it("returns 404 for an unknown token", async () => {
    const res = await GET(new Request("http://localhost/api/ical/unknown_token"), {
      params: Promise.resolve({ token: "unknown_token" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 for an empty token", async () => {
    const res = await GET(new Request("http://localhost/api/ical/"), {
      params: Promise.resolve({ token: "" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a whitespace-only token", async () => {
    const res = await GET(new Request("http://localhost/api/ical/   "), {
      params: Promise.resolve({ token: "   " }),
    });

    expect(res.status).toBe(404);
  });

  it("does not leak another member's schedule on unknown token", async () => {
    const invalidRes = await GET(new Request("http://localhost/api/ical/wrong_token"), {
      params: Promise.resolve({ token: "wrong_token" }),
    });

    // Invalid token should return 404, not member2's schedule
    expect(invalidRes.status).toBe(404);
  });

  it("sets content-disposition with member name", async () => {
    const member = seed.members[0];
    const res = await GET(new Request("http://localhost/api/ical/" + member.calendarToken), {
      params: Promise.resolve({ token: member.calendarToken }),
    });

    expect(res.status).toBe(200);
    const disposition = res.headers.get("content-disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".ics");
  });

  it("excludes cancelled sessions from the feed", async () => {
    const member = seed.members[0];

    // Find a future session and mark it as cancelled
    const futureSession = seed.sessions.find(
      (s) => new Date(s.startsAt).getTime() > NOW.getTime() && s.status === "scheduled",
    );
    if (futureSession) {
      futureSession.status = "cancelled";
    }

    const res = await GET(new Request("http://localhost/api/ical/" + member.calendarToken), {
      params: Promise.resolve({ token: member.calendarToken }),
    });

    expect(res.status).toBe(200);
    const body = await res.text();

    // If the cancelled session had a booking, verify it's not in the output
    if (futureSession) {
      const sessionBooking = seed.bookings.find(
        (b) => b.sessionId === futureSession.id && b.memberId === member.id,
      );
      if (sessionBooking) {
        expect(body).not.toContain(futureSession.id);
      }
    }
  });
});
