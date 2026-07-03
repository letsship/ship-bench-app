import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestDb } from "@/lib/db";
import { createTestDb } from "@/lib/db/local-db";
import { buildSeed } from "@/lib/db/seed-data";
import { seedDatabase } from "@/lib/db/seed-runner";
import type { Db } from "@/lib/db/types";

// Real route-handler integration: seed a test db, point getDb() at it via the
// __setTestDb seam, then drive the exported GET handlers end-to-end.
describe("API route handlers", () => {
  let db: Db;
  beforeEach(async () => {
    db = createTestDb();
    await seedDatabase(db, buildSeed());
    __setTestDb(db);
  });
  afterEach(() => {
    __setTestDb(null);
  });

  it("GET /api/classes returns seeded sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { occupancy: unknown }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(45);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a range filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2000-01-01T00:00:00Z&to=2000-01-02T00:00:00Z"),
    );
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(0);
  });

  it("GET /api/invoices returns seeded invoices", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBe(6);
  });

  it("GET /api/members returns seeded members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBe(8);
  });
});
