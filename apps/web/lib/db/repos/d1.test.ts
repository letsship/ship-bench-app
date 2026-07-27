import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import * as schema from "./schema";
import type { Repositories } from "./types";

// Runs the production Drizzle-over-D1 adapter against a real D1 database
// (via miniflare's local D1 simulator), seeded with the same buildSeed() the
// in-memory fakes use in fakes.test.ts — so both implementations are proven
// against one behavioural contract.

const NOW = new Date("2026-03-15T12:00:00.000Z");
const MIGRATION_PATH = fileURLToPath(new URL("../../../migrations/0001_init.sql", import.meta.url));

function migrationStatements(): string[] {
  const sql = readFileSync(MIGRATION_PATH, "utf-8");
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

// D1 caps bound parameters per statement well below SQLite's own limit, so
// seeding tables with many rows (e.g. six weeks of sessions) needs batching —
// unlike production inserts, which only ever write one row or one invoice's
// line items at a time.
async function insertAll<T extends Record<string, unknown>>(
  drz: ReturnType<typeof drizzle>,
  table: Parameters<typeof drz.insert>[0],
  rows: T[],
  batchSize = 10,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    await drz.insert(table).values(rows.slice(i, i + batchSize));
  }
}

describe("D1 repositories", () => {
  let mf: Miniflare;
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { async fetch() { return new Response(null); } };",
      d1Databases: ["DB"],
    });
    const binding = await mf.getD1Database("DB");
    for (const statement of migrationStatements()) {
      await binding.prepare(statement).run();
    }
  });

  afterAll(async () => {
    await mf.dispose();
  });

  beforeEach(async () => {
    const binding = await mf.getD1Database("DB");
    const drz = drizzle(binding, { schema });

    await drz.delete(schema.notificationOutbox);
    await drz.delete(schema.invoiceLineItems);
    await drz.delete(schema.invoices);
    await drz.delete(schema.bookings);
    await drz.delete(schema.classSessions);
    await drz.delete(schema.classTypes);
    await drz.delete(schema.members);
    await drz.delete(schema.studioSettings);
    await drz.delete(schema.studios);

    const seed = buildSeed(NOW);
    await drz.insert(schema.studios).values(seed.studio);
    await drz.insert(schema.studioSettings).values(seed.settings);
    await insertAll(drz, schema.members, seed.members);
    await insertAll(drz, schema.classTypes, seed.classTypes);
    await insertAll(drz, schema.classSessions, seed.sessions);
    await insertAll(drz, schema.bookings, seed.bookings);
    await insertAll(drz, schema.invoices, seed.invoices);
    await insertAll(drz, schema.invoiceLineItems, seed.lineItems);
    await insertAll(drz, schema.notificationOutbox, seed.outbox);

    repos = createD1Repositories(binding);
    studioId = seed.studio.id;
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
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
    expect(bookings.length).toBeGreaterThan(0);
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

  it("update returns the written row and persists the change", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });

  it("empty-input short-circuits return empty lists without querying", async () => {
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });
});
