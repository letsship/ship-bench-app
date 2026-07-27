import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import {
  bookings,
  classSessions,
  classTypes,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  studioSettings,
  studios,
} from "./schema";
import type { SeedData } from "./fakes";
import type { Repositories } from "./types";

// Integration test for the production D1/Drizzle repository implementation.
// A real D1 binding is provisioned locally (via wrangler's platform proxy,
// backed by the same SQLite engine D1 uses in production), the wrangler
// migration is applied against it, and the demo dataset is seeded directly
// through Drizzle — exercising the actual schema + adapter, not the fakes.

const NOW = new Date("2026-03-15T12:00:00.000Z");
const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../migrations/0001_init.sql",
);

function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function applyMigration(db: D1Database): Promise<void> {
  const sql = readFileSync(migrationPath, "utf8");
  for (const statement of splitStatements(sql)) {
    await db.prepare(statement).run();
  }
}

// D1 caps bound parameters per statement well below Postgres, so bulk-seeding
// the demo dataset (which the Supabase seed pipeline sent as one INSERT) has to
// go in chunks here — a test-setup concern only, not a repository behaviour.
function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

async function seedDatabase(db: D1Database, seed: SeedData): Promise<void> {
  const drizzleDb = drizzle(db);
  await drizzleDb.insert(studios).values(seed.studio);
  await drizzleDb.insert(studioSettings).values(seed.settings);
  for (const rows of chunk(seed.members, 10)) await drizzleDb.insert(members).values(rows);
  for (const rows of chunk(seed.classTypes, 10)) await drizzleDb.insert(classTypes).values(rows);
  for (const rows of chunk(seed.sessions, 10)) await drizzleDb.insert(classSessions).values(rows);
  for (const rows of chunk(seed.bookings, 10)) await drizzleDb.insert(bookings).values(rows);
  for (const rows of chunk(seed.invoices, 10)) await drizzleDb.insert(invoices).values(rows);
  for (const rows of chunk(seed.lineItems, 10))
    await drizzleDb.insert(invoiceLineItems).values(rows);
  for (const rows of chunk(seed.outbox, 10))
    await drizzleDb.insert(notificationOutbox).values(rows);
}

describe("D1 repositories", () => {
  let dispose: () => Promise<void>;
  let db: D1Database;
  let repos: Repositories;
  let seed: SeedData;

  beforeAll(async () => {
    const proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath: resolve(dirname(fileURLToPath(import.meta.url)), "../../../wrangler.jsonc"),
      persist: false,
    });
    dispose = proxy.dispose;
    db = proxy.env.DB;
    await applyMigration(db);
  }, 30_000);

  afterAll(async () => {
    await dispose();
  });

  beforeEach(async () => {
    for (const table of [
      "invoice_line_items",
      "invoices",
      "notification_outbox",
      "bookings",
      "class_sessions",
      "class_types",
      "members",
      "studio_settings",
      "studios",
    ]) {
      await db.prepare(`delete from ${table}`).run();
    }
    seed = buildSeed(NOW);
    await seedDatabase(db, seed);
    repos = createD1Repositories(db);
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe(seed.studio.name);
    const settings = await repos.settings.getByStudioId(seed.studio.id);
    expect(settings?.currency).toBe("EUR");
    expect(settings?.waitlistEnabled).toBe(true);
  });

  it("lists members sorted by name", async () => {
    const list = await repos.members.listByStudio(seed.studio.id);
    const names = list.map((member) => member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(list.length).toBe(seed.members.length);
  });

  it("finds a member by email within the studio", async () => {
    const found = await repos.members.findByEmail(seed.studio.id, "amara@example.com");
    expect(found?.name).toBe("Amara Okafor");
    expect(await repos.members.findByEmail(seed.studio.id, "nobody@example.com")).toBeNull();
  });

  it("lists class types sorted by name", async () => {
    const list = await repos.classTypes.listByStudio(seed.studio.id);
    const names = list.map((type) => type.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("filters sessions by an inclusive-from / exclusive-to range", async () => {
    const all = await repos.classSessions.listByStudio(seed.studio.id);
    expect(all).toEqual([...all].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(seed.studio.id, { from, to });
    expect(windowed.every((s) => s.startsAt >= from && s.startsAt < to)).toBe(true);
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("lists bookings across multiple session ids", async () => {
    const sessions = await repos.classSessions.listByStudio(seed.studio.id);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const found = await repos.bookings.listBySessionIds(ids);
    expect(found.every((b) => ids.includes(b.sessionId))).toBe(true);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("inserts a member then reads it back by id", async () => {
    const member = {
      id: "mem_new",
      studioId: seed.studio.id,
      name: "New Person",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    const inserted = await repos.members.insert(member);
    expect(inserted).toEqual(member);
    expect(await repos.members.getById("mem_new")).toEqual(member);
  });

  it("updates a booking and returns the patched row", async () => {
    const [booking] = seed.bookings;
    const updated = await repos.bookings.update(booking.id, { status: "cancelled" });
    expect(updated.status).toBe("cancelled");
    expect(updated.id).toBe(booking.id);
  });

  it("orders invoices by issuedAt desc and counts by studio", async () => {
    const list = await repos.invoices.listByStudio(seed.studio.id);
    const issuedAts = list.map((invoice) => invoice.issuedAt);
    expect(issuedAts).toEqual([...issuedAts].sort((a, b) => b.localeCompare(a)));
    expect(await repos.invoices.countByStudio(seed.studio.id)).toBe(seed.invoices.length);
  });

  it("inserts line items in bulk and short-circuits on empty input", async () => {
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
    const [invoice] = seed.invoices;
    const items = [
      {
        id: "li_new",
        invoiceId: invoice.id,
        description: "Extra item",
        quantity: 1,
        unitAmountCents: 500,
        amountCents: 500,
        refunded: false,
        bookingId: null,
      },
    ];
    const inserted = await repos.invoiceLineItems.insertMany(items);
    expect(inserted).toEqual(items);
    const listed = await repos.invoiceLineItems.listByInvoice(invoice.id);
    expect(listed.map((item) => item.id)).toContain("li_new");
  });

  it("lists only pending outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeLessThan(seed.outbox.length);
  });
});
