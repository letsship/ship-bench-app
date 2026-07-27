import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import * as schema from "../schema";
import { createDrizzleRepositories } from "./d1";
import type { Repositories } from "./types";

// Contract test for the Drizzle repository seam: applies the real D1 migration
// SQL to an in-memory SQLite database, then exercises `createDrizzleRepositories`
// (the same code `createD1Repositories` wraps around the D1 binding) against
// the demo seed data — mirroring the behavioural contract `fakes.test.ts` covers
// for the in-memory implementation.

const NOW = new Date("2026-03-15T12:00:00.000Z");
const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(join(HERE, "../../../migrations/0001_init.sql"), "utf-8");

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(MIGRATION_SQL);
  return drizzle(sqlite);
}

async function seedDb(db: ReturnType<typeof createTestDb>, seed: ReturnType<typeof buildSeed>) {
  await db.insert(schema.studios).values(seed.studio);
  await db.insert(schema.studioSettings).values(seed.settings);
  if (seed.members.length) await db.insert(schema.members).values(seed.members);
  if (seed.classTypes.length) await db.insert(schema.classTypes).values(seed.classTypes);
  if (seed.sessions.length) await db.insert(schema.classSessions).values(seed.sessions);
  if (seed.bookings.length) await db.insert(schema.bookings).values(seed.bookings);
  if (seed.invoices.length) await db.insert(schema.invoices).values(seed.invoices);
  if (seed.lineItems.length) await db.insert(schema.invoiceLineItems).values(seed.lineItems);
  if (seed.outbox.length) await db.insert(schema.notificationOutbox).values(seed.outbox);
}

describe("Drizzle repositories (D1 contract, over in-memory SQLite)", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    const db = createTestDb();
    const seed = buildSeed(NOW);
    await seedDb(db, seed);
    repos = createDrizzleRepositories(db);
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
  });

  it("inserts a member then reads it back by id", async () => {
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

  it("update returns the patched row", async () => {
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

  it("inserts invoice line items and lists them by invoice", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const invoice = invoices[0];
    const items = await repos.invoiceLineItems.listByInvoice(invoice.id);
    expect(items.every((item) => item.invoiceId === invoice.id)).toBe(true);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("empty database returns nulls / empty lists", async () => {
    const emptyDb = createTestDb();
    const empty = createDrizzleRepositories(emptyDb);
    expect(await empty.studios.getFirst()).toBeNull();
    expect(await empty.members.listByStudio("x")).toEqual([]);
    expect(await empty.bookings.listBySessionIds([])).toEqual([]);
  });
});
