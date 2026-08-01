import { readFileSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { SeedData } from "./fakes";
import * as schema from "./schema";
import type { Repositories } from "./types";

// Contract test for the production D1 adapter, mirroring fakes.test.ts: the
// same assertions run against a real in-process D1 database (Miniflare) with
// the wrangler migration applied, so the Drizzle implementation and the
// in-memory fakes stay behaviour-identical.

const NOW = new Date("2026-03-15T12:00:00.000Z");

const migrationSql = readFileSync(
  new URL("../../../migrations/0001_init.sql", import.meta.url),
  "utf8",
);

function migrationStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("D1 repositories", () => {
  let mf: Miniflare;
  let d1: D1Database;
  let repos: Repositories;
  let studioId: string;

  // Wipe children before parents so the foreign keys never block the reset.
  async function resetTables() {
    const db = drizzle(d1, { schema });
    await db.batch([
      db.delete(schema.notificationOutbox),
      db.delete(schema.invoiceLineItems),
      db.delete(schema.invoices),
      db.delete(schema.bookings),
      db.delete(schema.classSessions),
      db.delete(schema.classTypes),
      db.delete(schema.members),
      db.delete(schema.studioSettings),
      db.delete(schema.studios),
    ]);
  }

  // One row per statement keeps each query far below D1's bound-parameter
  // limit; a single batch keeps the whole seed to one workerd round trip.
  async function seedDatabase(seed: SeedData) {
    const db = drizzle(d1, { schema });
    const [first, ...rest] = [
      db.insert(schema.studios).values(seed.studio),
      db.insert(schema.studioSettings).values(seed.settings),
      ...seed.members.map((row) => db.insert(schema.members).values(row)),
      ...seed.classTypes.map((row) => db.insert(schema.classTypes).values(row)),
      ...seed.sessions.map((row) => db.insert(schema.classSessions).values(row)),
      ...seed.bookings.map((row) => db.insert(schema.bookings).values(row)),
      ...seed.invoices.map((row) => db.insert(schema.invoices).values(row)),
      ...seed.lineItems.map((row) => db.insert(schema.invoiceLineItems).values(row)),
      ...seed.outbox.map((row) => db.insert(schema.notificationOutbox).values(row)),
    ];
    await db.batch([first, ...rest]);
  }

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { fetch: () => new Response(null) };",
      d1Databases: { DB: "studiobook-test" },
    });
    d1 = (await mf.getD1Database("DB")) as unknown as D1Database;
    for (const statement of migrationStatements(migrationSql)) {
      await d1.prepare(statement).run();
    }
  }, 60_000);

  afterAll(async () => {
    await mf.dispose();
  });

  beforeEach(async () => {
    await resetTables();
    await seedDatabase(buildSeed(NOW));
    repos = createD1Repositories(d1);
    const studio = await repos.studios.getFirst();
    studioId = studio?.id ?? "";
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
    expect(settings?.waitlistEnabled).toBe(true);
  });

  it("lists members sorted by name", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((member) => member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(members.length).toBeGreaterThan(0);
  });

  it("finds a member by email within the studio", async () => {
    const found = await repos.members.findByEmail(studioId, "amara@example.com");
    expect(found?.name).toBe("Amara Okafor");
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();
  });

  it("filters sessions by an inclusive-from / exclusive-to range", async () => {
    const all = await repos.classSessions.listByStudio(studioId);
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(studioId, { from, to });
    expect(windowed.every((s) => s.startsAt >= from && s.startsAt < to)).toBe(true);
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("lists bookings across multiple session ids", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("inserts then reads back by id", async () => {
    const member = {
      id: "mem_new",
      studioId,
      name: "New Person",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    await repos.members.insert(member);
    expect(await repos.members.getById("mem_new")).toEqual(member);
  });

  it("update returns an isolated clone (store not mutated by reference)", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    updated.status = "active"; // mutate the returned object
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
    expect(list.map((row) => row.issuedAt)).toEqual(
      [...list].map((row) => row.issuedAt).sort((a, b) => b.localeCompare(a)),
    );
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("empty database returns nulls / empty lists", async () => {
    await resetTables();
    expect(await repos.studios.getFirst()).toBeNull();
    expect(await repos.members.listByStudio("x")).toEqual([]);
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });
});
