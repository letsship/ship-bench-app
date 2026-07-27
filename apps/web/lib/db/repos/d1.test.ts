import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schema } from "../schema";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Contract test for the Drizzle-over-D1 adapter. Spins up a real D1 database
// via miniflare, applies the wrangler migration SQL, seeds it from the same
// demo dataset the in-memory fakes use, then re-runs the fakes.test.ts
// assertions against it — proving the Drizzle mapping and migration SQL agree
// with the Repositories contract.

const NOW = new Date("2026-03-15T12:00:00.000Z");

const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../migrations/0001_create_studiobook_schema.sql",
);

function migrationStatements(): string[] {
  return readFileSync(migrationPath, "utf-8")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

// D1 caps bound parameters at 100 per statement, so seed rows (up to 10
// columns wide) are inserted in small chunks rather than one big batch insert.
function chunk<T>(rows: T[], size = 8): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

describe("D1 repositories", () => {
  let mf: Miniflare;
  let db: D1Database;
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { async fetch() { return new Response(null, { status: 404 }); } }",
      d1Databases: ["DB"],
    });
    db = await mf.getD1Database("DB");
    for (const statement of migrationStatements()) {
      await db.prepare(statement).run();
    }
  });

  afterAll(async () => {
    await mf.dispose();
  });

  beforeEach(async () => {
    const orm = drizzle(db, { schema });
    await orm.delete(schema.notificationOutbox);
    await orm.delete(schema.invoiceLineItems);
    await orm.delete(schema.invoices);
    await orm.delete(schema.bookings);
    await orm.delete(schema.classSessions);
    await orm.delete(schema.classTypes);
    await orm.delete(schema.members);
    await orm.delete(schema.studioSettings);
    await orm.delete(schema.studios);

    const seed = buildSeed(NOW);
    await orm.insert(schema.studios).values(seed.studio);
    await orm.insert(schema.studioSettings).values(seed.settings);
    for (const rows of chunk(seed.members)) await orm.insert(schema.members).values(rows);
    for (const rows of chunk(seed.classTypes)) await orm.insert(schema.classTypes).values(rows);
    for (const rows of chunk(seed.sessions)) await orm.insert(schema.classSessions).values(rows);
    for (const rows of chunk(seed.bookings)) await orm.insert(schema.bookings).values(rows);
    for (const rows of chunk(seed.invoices)) await orm.insert(schema.invoices).values(rows);
    for (const rows of chunk(seed.lineItems))
      await orm.insert(schema.invoiceLineItems).values(rows);
    for (const rows of chunk(seed.outbox)) await orm.insert(schema.notificationOutbox).values(rows);

    repos = createD1Repositories(db);
    studioId = seed.studio.id;
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
    expect(settings?.waitlistEnabled).toBe(true);
    expect(typeof settings?.waitlistEnabled).toBe("boolean");
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

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });
});
