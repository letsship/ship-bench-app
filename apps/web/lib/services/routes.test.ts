import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as icalByTokenGet } from "@/app/api/ical/[token]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
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

  it("GET /api/ical/[token] returns a calendar feed for a valid token", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const [seededMember] = await repos.members.listByStudio(
      (await repos.studios.getFirst())?.id ?? "",
    );
    const res = await icalByTokenGet(new NextRequest("http://localhost/api/ical/x"), {
      params: Promise.resolve({ token: seededMember.calendarToken }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
  });

  it("GET /api/ical/[token] 404s for an unknown token", async () => {
    const res = await icalByTokenGet(new NextRequest("http://localhost/api/ical/nope"), {
      params: Promise.resolve({ token: "not-a-real-token" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/ical/[token] 404s for an empty token", async () => {
    const res = await icalByTokenGet(new NextRequest("http://localhost/api/ical/"), {
      params: Promise.resolve({ token: "" }),
    });
    expect(res.status).toBe(404);
  });
});
