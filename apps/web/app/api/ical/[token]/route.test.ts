import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { GET } from "./route";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET /api/ical/[token]", () => {
  let memberToken: string;

  beforeEach(async () => {
    const seed = buildSeed(NOW);
    memberToken = seed.members[0].calendarToken;
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  function callWithToken(token: string): Promise<Response> {
    return GET(new Request(`http://localhost/api/ical/${token}`), {
      params: Promise.resolve({ token }),
    });
  }

  it("returns a text/calendar feed scoped to the token-holder for a valid token", async () => {
    const res = await callWithToken(memberToken);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
  });

  it("returns 404 for an unknown token", async () => {
    const res = await callWithToken("not-a-real-token");
    expect(res.status).toBe(404);
  });

  it("returns 404 for an empty token", async () => {
    const res = await callWithToken("");
    expect(res.status).toBe(404);
  });
});
