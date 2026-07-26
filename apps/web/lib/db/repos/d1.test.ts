import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import * as schema from "./schema";
import type { Repositories } from "./types";

// Integration test for the D1/Drizzle adapter: applies the real migration SQL
// to an in-memory D1 database (via miniflare) and exercises the same
// behavioural assertions as fakes.test.ts, validating schema + adapter
// together.

const NOW = new Date("2026-03-15T12:00:00.000Z");

const migrationSql = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../migrations/0001_init.sql"),
  "utf-8",
);

// D1's exec() treats each newline as a statement boundary and rejects
// comment-only lines, so strip comments and flatten the migration onto a
// single line of `;`-separated statements before executing it.
const migrationScript = migrationSql
  .split("\n")
  .map((line) => line.replace(/--.*$/, "").trim())
  .filter((line) => line.length > 0)
  .join(" ");

const TABLES_CHILD_FIRST = [
  "notification_outbox",
  "invoice_line_items",
  "invoices",
  "bookings",
  "class_sessions",
  "class_types",
  "members",
  "studio_settings",
  "studios",
];

const mf = new Miniflare({
  modules: true,
  script: "export default { fetch: () => new Response('ok') };",
  d1Databases: { DB: ":memory:" },
});

// D1 caps bound parameters per statement (~100), which a single multi-row
// `.values([...])` call blows past for the larger seed tables — insert rows
// one at a time instead.
async function insertAll<T extends object>(
  orm: ReturnType<typeof drizzle<typeof schema>>,
  table: Parameters<ReturnType<typeof drizzle<typeof schema>>["insert"]>[0],
  rows: T[],
): Promise<void> {
  for (const row of rows) {
    await orm.insert(table).values(row);
  }
}

async function reseed(): Promise<{ repos: Repositories; studioId: string }> {
  const db = await mf.getD1Database("DB");
  for (const table of TABLES_CHILD_FIRST) {
    await db.exec(`delete from ${table}`);
  }

  const orm = drizzle(db, { schema });
  const seed = buildSeed(NOW);
  await orm.insert(schema.studios).values(seed.studio);
  await orm.insert(schema.studioSettings).values(seed.settings);
  await insertAll(orm, schema.members, seed.members);
  await insertAll(orm, schema.classTypes, seed.classTypes);
  await insertAll(orm, schema.classSessions, seed.sessions);
  await insertAll(orm, schema.bookings, seed.bookings);
  await insertAll(orm, schema.invoices, seed.invoices);
  await insertAll(orm, schema.invoiceLineItems, seed.lineItems);
  await insertAll(orm, schema.notificationOutbox, seed.outbox);

  return { repos: createD1Repositories(db), studioId: seed.studio.id };
}

describe("D1 repositories (Drizzle over Cloudflare D1)", () => {
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    const db = await mf.getD1Database("DB");
    await db.exec(migrationScript);
  });

  afterAll(async () => {
    await mf.dispose();
  });

  beforeEach(async () => {
    ({ repos, studioId } = await reseed());
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
});
