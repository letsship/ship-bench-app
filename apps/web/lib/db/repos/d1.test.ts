import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Parity suite for the D1/Drizzle production adapter. Rather than a hand-rolled
// D1 shim, this spins up a real `D1Database` binding via Miniflare (the engine
// wrangler itself uses), applies the actual migrations/0001_init.sql, and
// seeds it with the same buildSeed() dataset the in-memory fakes use — so
// these assertions mirror fakes.test.ts and exercise the real SQL semantics
// (constraints, ordering, filtering) rather than a simulation of them.

const NOW = new Date("2026-03-15T12:00:00.000Z");
const MIGRATION_SQL = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../migrations/0001_init.sql"),
  "utf-8",
);

function migrationStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

describe("D1 repositories (Drizzle over a real D1Database)", () => {
  let mf: Miniflare;
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { async fetch() { return new Response('ok'); } };",
      d1Databases: ["DB"],
    });
    const db = await mf.getD1Database("DB");

    for (const statement of migrationStatements(MIGRATION_SQL)) {
      await db.prepare(statement).run();
    }

    const seed = buildSeed(NOW);
    const drz = drizzle(db, { schema });
    // D1 caps bound variables per statement, so seed row-by-row rather than in
    // one large batched INSERT (fine for a one-time test fixture).
    await drz.insert(schema.studios).values(seed.studio);
    await drz.insert(schema.studioSettings).values(seed.settings);
    for (const member of seed.members) await drz.insert(schema.members).values(member);
    for (const classType of seed.classTypes) await drz.insert(schema.classTypes).values(classType);
    for (const session of seed.sessions) await drz.insert(schema.classSessions).values(session);
    for (const booking of seed.bookings) await drz.insert(schema.bookings).values(booking);
    for (const invoice of seed.invoices) await drz.insert(schema.invoices).values(invoice);
    for (const item of seed.lineItems) await drz.insert(schema.invoiceLineItems).values(item);
    for (const row of seed.outbox) await drz.insert(schema.notificationOutbox).values(row);

    repos = createD1Repositories(db);
    studioId = seed.studio.id;
  }, 30000);

  afterAll(async () => {
    await mf.dispose();
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
    expect(windowed).toEqual([...windowed].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  });

  it("lists bookings across multiple session ids", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("inserts a member then reads it back by id", async () => {
    const member = {
      id: "00000000-0000-4000-8000-00000000abcd",
      studioId,
      name: "New Person",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    const inserted = await repos.members.insert(member);
    expect(inserted).toEqual(member);
    expect(await repos.members.getById(member.id)).toEqual(member);
  });

  it("update persists the patch", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
    await repos.members.update(target.id, { status: target.status });
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
    expect(count).toBeGreaterThan(0);
  });

  it("lists invoices ordered by issuedAt descending", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const issuedDates = invoices.map((invoice) => invoice.issuedAt);
    expect(issuedDates).toEqual([...issuedDates].sort((a, b) => b.localeCompare(a)));
  });

  it("insertMany inserts line items and short-circuits on empty input", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const invoiceId = invoices[0].id;
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
    const items = [
      {
        id: "00000000-0000-4000-8000-00000000abce",
        invoiceId,
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
    const listed = await repos.invoiceLineItems.listByInvoice(invoiceId);
    expect(listed.map((item) => item.id)).toContain(items[0].id);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });
});
