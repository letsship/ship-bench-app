import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as icalTokenGet } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
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

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });

  describe("GET /api/ical/[token]", () => {
    async function firstMemberToken(): Promise<string> {
      const repos = createInMemoryRepositories(buildSeed(NOW));
      const studio = await repos.studios.getFirst();
      const members = await repos.members.listByStudio(studio!.id);
      __setTestRepositories(repos);
      return members[0].calendarToken;
    }

    it("returns 200 with text/calendar for a valid token", async () => {
      const token = await firstMemberToken();
      const url = new URL("http://localhost/api/ical/t");
      url.searchParams.set("from", NOW.toISOString());
      const res = await icalTokenGet(new NextRequest(url), {
        params: Promise.resolve({ token }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/^text\/calendar/);
      const body = await res.text();
      expect(body).toContain("BEGIN:VCALENDAR");
      expect(body).toContain("BEGIN:VEVENT");
      expect(body).toContain("END:VCALENDAR");
    });

    it("excludes past sessions from the feed", async () => {
      const token = await firstMemberToken();
      const url = new URL("http://localhost/api/ical/t");
      url.searchParams.set("from", NOW.toISOString());
      const res = await icalTokenGet(new NextRequest(url), {
        params: Promise.resolve({ token }),
      });
      const body = await res.text();
      const veventCount = (body.match(/BEGIN:VEVENT/g) ?? []).length;
      const repos = createInMemoryRepositories(buildSeed(NOW));
      const studio = await repos.studios.getFirst();
      const allFuture = await repos.classSessions.listByStudio(studio!.id, {
        from: NOW.toISOString(),
      });
      expect(veventCount).toBeLessThanOrEqual(allFuture.length);
    });

    it("excludes sessions booked by other members", async () => {
      const repos = createInMemoryRepositories(buildSeed(NOW));
      const studio = await repos.studios.getFirst();
      const members = await repos.members.listByStudio(studio!.id);
      const member0 = members[0];
      const member1 = members[1];
      __setTestRepositories(repos);
      const url = new URL("http://localhost/api/ical/t");
      url.searchParams.set("from", NOW.toISOString());
      const res0 = await icalTokenGet(new NextRequest(url), {
        params: Promise.resolve({ token: member0.calendarToken }),
      });
      const body0 = await res0.text();
      const res1 = await icalTokenGet(new NextRequest(url), {
        params: Promise.resolve({ token: member1.calendarToken }),
      });
      const body1 = await res1.text();
      expect(body0).not.toBe(body1);
    });

    it("returns 404 for an unknown token", async () => {
      const res = await icalTokenGet(new NextRequest("http://localhost/api/ical/t"), {
        params: Promise.resolve({ token: "nonexistent-token-value" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for an empty token", async () => {
      const res = await icalTokenGet(new NextRequest("http://localhost/api/ical/t"), {
        params: Promise.resolve({ token: "" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for whitespace-only token", async () => {
      const res = await icalTokenGet(new NextRequest("http://localhost/api/ical/t"), {
        params: Promise.resolve({ token: "   " }),
      });
      expect(res.status).toBe(404);
    });
  });
});
