import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { buildSeed } from "../seed-data";
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
} from "../schema";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Behavioural contract test for the D1/Drizzle repository adapter, exercised
// against a real (in-memory) D1 database via miniflare — the same engine
// wrangler uses for local dev. Mirrors fakes.test.ts's contract so both
// implementations stay symmetric.

const NOW = new Date("2026-03-15T12:00:00.000Z");

const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../migrations/0001_init.sql",
);

// D1 caps bound parameters per statement, so bulk-seeding a wide table (e.g.
// ~40 class sessions x 10 columns) in one insert can exceed it. Chunk rows.
function chunk<T>(rows: T[], size = 8): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

function migrationStatements(): string[] {
  const withoutComments = readFileSync(migrationPath, "utf-8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

describe("D1 repositories (Drizzle over miniflare)", () => {
  let mf: Miniflare;
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('ok'); } };",
      d1Databases: { DB: "studiobook-test" },
    });
    const db = await mf.getD1Database("DB");
    for (const statement of migrationStatements()) {
      await db.prepare(statement).run();
    }
    repos = createD1Repositories(db);

    const drizzleDb = drizzle(db);
    const seed = buildSeed(NOW);
    studioId = seed.studio.id;
    await drizzleDb.insert(studios).values(seed.studio);
    await drizzleDb.insert(studioSettings).values(seed.settings);
    for (const rows of chunk(seed.members)) await drizzleDb.insert(members).values(rows);
    for (const rows of chunk(seed.classTypes)) await drizzleDb.insert(classTypes).values(rows);
    for (const rows of chunk(seed.sessions)) await drizzleDb.insert(classSessions).values(rows);
    for (const rows of chunk(seed.bookings)) await drizzleDb.insert(bookings).values(rows);
    for (const rows of chunk(seed.invoices)) await drizzleDb.insert(invoices).values(rows);
    for (const rows of chunk(seed.lineItems)) await drizzleDb.insert(invoiceLineItems).values(rows);
    for (const rows of chunk(seed.outbox)) await drizzleDb.insert(notificationOutbox).values(rows);
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
  });

  it("lists members sorted by name", async () => {
    const list = await repos.members.listByStudio(studioId);
    const names = list.map((member) => member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(list.length).toBeGreaterThan(0);
  });

  it("finds a member by email within the studio", async () => {
    const found = await repos.members.findByEmail(studioId, "amara@example.com");
    expect(found?.name).toBe("Amara Okafor");
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();
  });

  it("lists class types sorted by name", async () => {
    const list = await repos.classTypes.listByStudio(studioId);
    const names = list.map((classType) => classType.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(list.length).toBeGreaterThan(0);
  });

  it("filters sessions by an inclusive-from / exclusive-to range, ordered by start", async () => {
    const all = await repos.classSessions.listByStudio(studioId);
    expect(all.map((s) => s.startsAt)).toEqual([...all.map((s) => s.startsAt)].sort());
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(studioId, { from, to });
    expect(windowed.every((s) => s.startsAt >= from && s.startsAt < to)).toBe(true);
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("lists bookings across multiple session ids, and returns [] for an empty list", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const found = await repos.bookings.listBySessionIds(ids);
    expect(found.every((b) => ids.includes(b.sessionId))).toBe(true);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("orders invoices by issued_at descending", async () => {
    const list = await repos.invoices.listByStudio(studioId);
    const issuedAts = list.map((invoice) => invoice.issuedAt);
    expect(issuedAts).toEqual([...issuedAts].sort().reverse());
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("insertMany returns [] for an empty list, and round-trips line items otherwise", async () => {
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
    const [invoice] = await repos.invoices.listByStudio(studioId);
    const item = {
      id: "line_new",
      invoiceId: invoice.id,
      description: "Drop-in class",
      quantity: 1,
      unitAmountCents: 1800,
      amountCents: 1800,
      refunded: false,
      bookingId: null,
    };
    const inserted = await repos.invoiceLineItems.insertMany([item]);
    expect(inserted).toEqual([item]);
    const listed = await repos.invoiceLineItems.listByInvoice(invoice.id);
    expect(listed).toContainEqual(item);
  });

  it("inserts then reads a member back by id", async () => {
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

  it("update returns the persisted row", async () => {
    const list = await repos.members.listByStudio(studioId);
    const target = list[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    expect(await repos.members.getById(target.id)).toEqual(updated);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });
});
