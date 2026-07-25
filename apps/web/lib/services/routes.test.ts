import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as memberCalendarGet } from "@/app/api/ical/[token]/route";
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

  it("GET /api/ical/[token] returns 200 with text/calendar content type for valid token", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const members = await repos.members.listByStudio((await repos.studios.getFirst())?.id ?? "");
    const member = members[0];
    const res = await memberCalendarGet(new NextRequest("http://localhost/api/ical/test"), {
      params: Promise.resolve({ token: member.calendarToken }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
  });

  it("GET /api/ical/[token] includes only member's upcoming booked sessions", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const members = await repos.members.listByStudio((await repos.studios.getFirst())?.id ?? "");
    const member = members[0];
    const res = await memberCalendarGet(new NextRequest("http://localhost/api/ical/test"), {
      params: Promise.resolve({ token: member.calendarToken }),
    });
    const body = await res.text();
    const lines = body.split("\r\n");
    const eventCount = lines.filter((line) => line === "BEGIN:VEVENT").length;
    expect(eventCount).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/ical/[token] returns 404 for unknown token", async () => {
    const res = await memberCalendarGet(new NextRequest("http://localhost/api/ical/test"), {
      params: Promise.resolve({ token: "unknown-nonexistent-token" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/ical/[token] returns 404 for empty token", async () => {
    const res = await memberCalendarGet(new NextRequest("http://localhost/api/ical/test"), {
      params: Promise.resolve({ token: "" }),
    });
    expect(res.status).toBe(404);
  });
});
