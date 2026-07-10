import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSession } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { GET } from "./route";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// next/headers' cookies() requires a live Next request scope, which route
// handler unit tests don't have. Stand in a plain in-memory jar so
// startSession()/requireSession() (both go through cookies()) work here.
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

async function get(query = ""): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/export?type=bookings${query}`));
}

describe("GET /api/export?type=bookings", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });

  afterEach(() => {
    __setTestRepositories(null);
    cookieJar.clear();
  });

  it("requires a signed-in session", async () => {
    const res = await get();
    expect(res.status).toBe(401);
  });

  it("returns a CSV download with the expected headers", async () => {
    await startSession("owner@example.com");
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="studiobook-bookings.csv"',
    );
    const csv = await res.text();
    expect(csv.split("\r\n")[0]).toBe("Starts,Class,Member,Email,Status");
  });

  it("filters by from/to, inclusive of both bounds", async () => {
    await startSession("owner@example.com");
    const all = await get();
    const starts = [
      ...new Set(
        (await all.text())
          .split("\r\n")
          .slice(1)
          .map((row) => row.split(",")[0]),
      ),
    ].sort();
    const from = starts[1];
    const to = starts[starts.length - 2];

    const res = await get(`&from=${from}&to=${to}`);
    const filteredStarts = (await res.text())
      .split("\r\n")
      .slice(1)
      .map((row) => row.split(",")[0]);

    expect(filteredStarts.length).toBeGreaterThan(0);
    expect(filteredStarts).toContain(from);
    expect(filteredStarts).toContain(to);
    expect(filteredStarts.every((starts_) => starts_ >= from && starts_ <= to)).toBe(true);
  });

  it("keeps a comma-containing member name in one quoted CSV field", async () => {
    const [member] = await repos.members.listByStudio((await repos.studios.getFirst())!.id);
    await repos.members.update(member.id, { name: "Rossi, Chiara" });

    await startSession("owner@example.com");
    const res = await get();
    const csv = await res.text();

    expect(csv).toContain(`"Rossi, Chiara",${member.email}`);
  });
});
