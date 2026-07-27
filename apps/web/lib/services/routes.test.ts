import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as memberIcalGet } from "@/app/api/ical/[token]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// The tokenized calendar route takes its token from the App Router params
// promise; no cookie is set on any of these requests.
const icalRequest = (token: string) =>
  memberIcalGet(new NextRequest(`http://localhost/api/ical/${token}`), {
    params: Promise.resolve({ token }),
  });

describe("GET route handlers (against injected fake repositories)", () => {
  let seed: SeedData;

  beforeEach(() => {
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members without their calendar tokens", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((member) => !("calendarToken" in member))).toBe(true);
  });

  // The route reads "now" from the clock, so pin it to the seed's reference
  // point — otherwise every seeded session is already in the past.
  describe("GET /api/ical/:token — the private per-member feed", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns that member's upcoming booked sessions", async () => {
      const member = seed.members[0];
      const res = await icalRequest(member.calendarToken);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/calendar");

      const body = await res.text();
      expect(body).toContain("BEGIN:VCALENDAR");
      expect(body).toContain("END:VCALENDAR");

      const future = new Set(
        seed.sessions.filter((s) => new Date(s.startsAt) >= NOW).map((session) => session.id),
      );
      const mine = seed.bookings.filter(
        (b) => b.memberId === member.id && b.status === "booked" && future.has(b.sessionId),
      );
      expect(mine.length).toBeGreaterThan(0);
      for (const booking of mine) {
        expect(body).toContain(`UID:${booking.sessionId}@member.studiobook`);
      }
      // Exactly those sessions — nobody else's, and nothing already past.
      expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(mine.length);
    });

    it("omits another member's sessions", async () => {
      const [alice, bob] = seed.members;
      const booked = (memberId: string) =>
        new Set(
          seed.bookings
            .filter((b) => b.memberId === memberId && b.status === "booked")
            .map((b) => b.sessionId),
        );
      const aliceSessions = booked(alice.id);
      const bobOnly = [...booked(bob.id)].filter((id) => !aliceSessions.has(id));
      expect(bobOnly.length).toBeGreaterThan(0);

      const body = await (await icalRequest(alice.calendarToken)).text();
      for (const sessionId of bobOnly) expect(body).not.toContain(sessionId);
    });

    it("404s for an unknown token", async () => {
      const res = await icalRequest("totally-made-up-token");
      expect(res.status).toBe(404);
      expect((await res.json()) as { error: { code: string } }).toMatchObject({
        error: { code: "not_found" },
      });
    });

    it("404s for an empty token", async () => {
      expect((await icalRequest("")).status).toBe(404);
    });
  });
});
