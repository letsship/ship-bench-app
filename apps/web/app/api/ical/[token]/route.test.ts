import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/ical/[token]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { listMemberUpcomingSessions } from "@/lib/services/classes";

const NOW = new Date("2026-03-15T12:00:00.000Z");

const get = (token: string) =>
  GET(new NextRequest(`http://localhost/api/ical/${token}`), {
    params: Promise.resolve({ token }),
  });

describe("GET /api/ical/[token]", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    __setTestRepositories(null);
  });

  it("returns an iCalendar feed of only the token-holder's upcoming booked sessions", async () => {
    const member = await repos.members.findByEmail(
      (await repos.studios.getFirst())?.id ?? "",
      "amara@example.com",
    );
    expect(member?.calendarToken).toBeTruthy();
    const res = await get(member?.calendarToken ?? "");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");

    const expected = await listMemberUpcomingSessions(
      repos,
      member?.studioId ?? "",
      member?.id ?? "",
      new Date().toISOString(),
    );
    expect(expected.length).toBeGreaterThan(0);
    for (const session of expected) {
      expect(body).toContain(`UID:${session.id}@studiobook`);
      expect(new Date(session.startsAt).getTime()).toBeGreaterThanOrEqual(Date.now());
    }
    expect(body.match(/BEGIN:VEVENT/g)?.length).toBe(expected.length);
  });

  it("excludes other members' sessions and the member's past sessions", async () => {
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const member = await repos.members.findByEmail(studioId, "amara@example.com");
    const res = await get(member?.calendarToken ?? "");
    const body = await res.text();

    const allUpcoming = (await repos.classSessions.listByStudio(studioId, {
      from: new Date().toISOString(),
    })).map((s) => s.id);
    const mine = new Set(
      (
        await listMemberUpcomingSessions(repos, studioId, member?.id ?? "", new Date().toISOString())
      ).map((s) => s.id),
    );
    for (const sessionId of allUpcoming) {
      if (!mine.has(sessionId)) expect(body).not.toContain(`UID:${sessionId}@studiobook`);
    }
    const past = await repos.classSessions.listByStudio(studioId, {
      to: new Date().toISOString(),
    });
    for (const session of past) {
      expect(body).not.toContain(`UID:${session.id}@studiobook`);
    }
  });

  it("404s for an unknown token", async () => {
    const res = await get("made-up-token-that-does-not-exist");
    expect(res.status).toBe(404);
  });

  it("404s for an empty token", async () => {
    const res = await get(" ");
    expect(res.status).toBe(404);
  });

  it("requires no session cookie — the token alone authorizes", async () => {
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const member = await repos.members.findByEmail(studioId, "bram@example.com");
    const request = new NextRequest(`http://localhost/api/ical/${member?.calendarToken}`);
    expect(request.cookies.getAll()).toEqual([]);
    const res = await GET(request, {
      params: Promise.resolve({ token: member?.calendarToken ?? "" }),
    });
    expect(res.status).toBe(200);
  });
});
