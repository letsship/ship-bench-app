import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { buildSeed } from "../seed-data";
import type { Studio, StudioSettings } from "../types";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Contract test for the D1/Drizzle repository, mirroring fakes.test.ts. Stands
// up a real D1 instance via Miniflare (the wrangler devDep's workerd-backed
// D1), applies apps/web/migrations/0001_init.sql, seeds it, and exercises the
// same read/write flows. Behaviour must match the in-memory fakes.

const MIGRATION_PATH = fileURLToPath(new URL("../../../migrations/0001_init.sql", import.meta.url));

let rawDb: D1Database;

async function freshD1(name = "studiobook-test"): Promise<D1Database> {
  const instance = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    d1Databases: { DB: name },
  });
  const db = await instance.getD1Database("DB");
  const migration = await readFile(MIGRATION_PATH, "utf8");
  const statements = migration
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
  return db;
}

async function insertStudio(studio: Studio, settings: StudioSettings): Promise<void> {
  await rawDb
    .prepare(
      "insert into studios (id, name, slug, timezone, created_at) values (?, ?, ?, ?, ?)",
    )
    .bind(studio.id, studio.name, studio.slug, studio.timezone, studio.createdAt)
    .run();
  await rawDb
    .prepare(
      `insert into studio_settings (studio_id, currency, tax_rate_bps, cancellation_window_hours,
        waitlist_enabled, notify_booking_confirmations, notify_cancellations,
        notify_waitlist_promotions, notify_invoices) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      settings.studioId,
      settings.currency,
      settings.taxRateBps,
      settings.cancellationWindowHours,
      settings.waitlistEnabled ? 1 : 0,
      settings.notifyBookingConfirmations ? 1 : 0,
      settings.notifyCancellations ? 1 : 0,
      settings.notifyWaitlistPromotions ? 1 : 0,
      settings.notifyInvoices ? 1 : 0,
    )
    .run();
}

async function seed(repos: Repositories): Promise<void> {
  const data = buildSeed(NOW);
  await insertStudio(data.studio, data.settings);
  for (const member of data.members) await repos.members.insert(member);
  for (const classType of data.classTypes) await repos.classTypes.insert(classType);
  for (const session of data.sessions) await repos.classSessions.insert(session);
  for (const booking of data.bookings) await repos.bookings.insert(booking);
  for (const invoice of data.invoices) await repos.invoices.insert(invoice);
  await repos.invoiceLineItems.insertMany(data.lineItems);
  for (const row of data.outbox) await repos.outbox.insert(row);
}

describe("D1 repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    rawDb = await freshD1();
  });

  beforeEach(async () => {
    for (const table of [
      "notification_outbox",
      "invoice_line_items",
      "invoices",
      "bookings",
      "class_sessions",
      "class_types",
      "members",
      "studio_settings",
      "studios",
    ]) {
      await rawDb.prepare(`delete from ${table}`).run();
    }
    repos = createD1Repositories(rawDb);
    await seed(repos);
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

  it("returns [] for an empty listBySessionIds", async () => {
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

  it("lists invoices ordered by issued_at desc", async () => {
    const list = await repos.invoices.listByStudio(studioId);
    const issued = list.map((invoice) => invoice.issuedAt);
    expect(issued).toEqual([...issued].sort((a, b) => b.localeCompare(a)));
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("invoiceLineItems.insertMany returns [] for empty input", async () => {
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("update returns an isolated row", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("empty repositories return nulls / empty lists", async () => {
    const emptyDb = await freshD1("studiobook-empty");
    const empty = createD1Repositories(emptyDb);
    expect(await empty.studios.getFirst()).toBeNull();
    expect(await empty.members.listByStudio("x")).toEqual([]);
  });
});
