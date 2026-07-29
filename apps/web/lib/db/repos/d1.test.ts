import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed, SEED_NOW } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// A minimal D1Database surface over better-sqlite3 — just enough for Drizzle's
// d1 driver (drizzle-orm/d1) to drive an in-memory SQLite. The production
// adapter runs unchanged against this shim, so the repository contract is
// exercised against a real SQLite engine without the Workers runtime.

type D1Result = { results: Record<string, unknown>[]; success: boolean; meta: Record<string, unknown> };

class D1PreparedStatement {
  constructor(
    private readonly stmt: Database.Statement,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new D1PreparedStatement(this.stmt, values);
  }

  async all(): Promise<D1Result> {
    const results = this.stmt.all(...this.params) as Record<string, unknown>[];
    return { results, success: true, meta: { rows_read: results.length } };
  }

  async run(): Promise<D1Result> {
    const info = this.stmt.run(...this.params);
    return { results: [], success: true, meta: { changes: info.changes } };
  }

  async first(): Promise<Record<string, unknown> | null> {
    return (this.stmt.get(...this.params) as Record<string, unknown> | undefined) ?? null;
  }

  async raw(): Promise<unknown[]> {
    this.stmt.raw(true);
    try {
      return this.stmt.all(...this.params) as unknown[];
    } finally {
      this.stmt.raw(false);
    }
  }
}

class D1DatabaseShim {
  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): D1PreparedStatement {
    return new D1PreparedStatement(this.db.prepare(sql));
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const stmt of statements) results.push(await stmt.all());
    return results;
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(
  resolve(__dirname, "../../../migrations/0001_init.sql"),
  "utf8",
);

type D1Binding = Parameters<typeof createD1Repositories>[0];

function createRepos(): { repos: Repositories; seedStudioSettings: () => void } {
  const sqlite = new Database(":memory:");
  sqlite.exec(MIGRATION_SQL);
  const repos = createD1Repositories(new D1DatabaseShim(sqlite) as unknown as D1Binding);
  // The repository interface intentionally exposes no studio/settings inserts
  // (services assume a studio already exists), so seed those directly.
  const seedStudioSettings = () => {
    const studio = buildSeed(SEED_NOW).studio;
    const settings = buildSeed(SEED_NOW).settings;
    sqlite
      .prepare(
        "insert into studios (id, name, slug, timezone, created_at) values (?, ?, ?, ?, ?)",
      )
      .run(studio.id, studio.name, studio.slug, studio.timezone, studio.createdAt);
    sqlite
      .prepare(
        `insert into studio_settings
          (studio_id, currency, tax_rate_bps, cancellation_window_hours, waitlist_enabled,
           notify_booking_confirmations, notify_cancellations, notify_waitlist_promotions, notify_invoices)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        settings.studioId,
        settings.currency,
        settings.taxRateBps,
        settings.cancellationWindowHours,
        settings.waitlistEnabled ? 1 : 0,
        settings.notifyBookingConfirmations ? 1 : 0,
        settings.notifyCancellations ? 1 : 0,
        settings.notifyWaitlistPromotions ? 1 : 0,
        settings.notifyInvoices ? 1 : 0,
      );
  };
  return { repos, seedStudioSettings };
}

const NOW = SEED_NOW;

describe("d1 repositories", () => {
  let repos: Repositories;
  let studioId: string;
  let seed: ReturnType<typeof buildSeed>;

  beforeEach(async () => {
    const harness = createRepos();
    repos = harness.repos;
    seed = buildSeed(NOW);
    harness.seedStudioSettings();
    studioId = seed.studio.id;
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe(seed.studio.name);
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
    expect(settings?.waitlistEnabled).toBe(true);
    expect(settings?.notifyInvoices).toBe(true);
  });

  it("updates studio settings and returns the patched row", async () => {
    const updated = await repos.settings.update(studioId, { taxRateBps: 1900 });
    expect(updated.taxRateBps).toBe(1900);
    expect((await repos.settings.getByStudioId(studioId))?.taxRateBps).toBe(1900);
  });

  it("inserts then reads a member back by id, preserving booleans + iso timestamps", async () => {
    const member = seed.members[0];
    await repos.members.insert(member);
    const fetched = await repos.members.getById(member.id);
    expect(fetched).toEqual(member);
    expect(typeof fetched?.notificationsOptedOut).toBe("boolean");
    expect(fetched?.createdAt).toBe(member.createdAt);
  });

  it("finds a member by email within the studio and returns null otherwise", async () => {
    const member = seed.members[0];
    await repos.members.insert(member);
    expect((await repos.members.findByEmail(studioId, member.email))?.id).toBe(member.id);
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();
  });

  it("lists members sorted by name", async () => {
    for (const m of seed.members) await repos.members.insert(m);
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("updates a member and returns the patched row", async () => {
    const member = seed.members[0];
    await repos.members.insert(member);
    const updated = await repos.members.update(member.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    expect((await repos.members.getById(member.id))?.status).toBe("paused");
  });

  it("lists class types sorted by name", async () => {
    for (const ct of seed.classTypes) await repos.classTypes.insert(ct);
    const list = await repos.classTypes.listByStudio(studioId);
    const names = list.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("lists sessions ordered by starts_at ascending", async () => {
    for (const s of seed.sessions) await repos.classSessions.insert(s);
    const list = await repos.classSessions.listByStudio(studioId);
    const starts = list.map((s) => s.startsAt);
    expect(starts).toEqual([...starts].sort());
  });

  it("filters sessions by an inclusive-from / exclusive-to range", async () => {
    for (const s of seed.sessions) await repos.classSessions.insert(s);
    const all = await repos.classSessions.listByStudio(studioId);
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(studioId, { from, to });
    expect(windowed.every((s) => s.startsAt >= from && s.startsAt < to)).toBe(true);
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("lists bookings across multiple session ids with an empty-array short-circuit", async () => {
    for (const m of seed.members) await repos.members.insert(m);
    for (const s of seed.sessions) await repos.classSessions.insert(s);
    for (const b of seed.bookings) await repos.bookings.insert(b);
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("lists invoices ordered by issued_at descending", async () => {
    for (const m of seed.members) await repos.members.insert(m);
    for (const inv of seed.invoices) await repos.invoices.insert(inv);
    const list = await repos.invoices.listByStudio(studioId);
    const issued = list.map((i) => i.issuedAt);
    expect(issued).toEqual([...issued].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)));
  });

  it("counts invoices for the studio", async () => {
    for (const m of seed.members) await repos.members.insert(m);
    for (const inv of seed.invoices) await repos.invoices.insert(inv);
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("inserts invoice line items in bulk and reads them back", async () => {
    for (const m of seed.members) await repos.members.insert(m);
    for (const inv of seed.invoices) await repos.invoices.insert(inv);
    const invoice = seed.invoices[0];
    await repos.invoiceLineItems.insertMany(seed.lineItems);
    const fetched = await repos.invoiceLineItems.listByInvoice(invoice.id);
    expect(fetched.length).toBeGreaterThan(0);
    expect(fetched.every((li) => li.invoiceId === invoice.id)).toBe(true);
    expect(typeof fetched[0].refunded).toBe("boolean");
  });

  it("insertMany with an empty array is a no-op", async () => {
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("round-trips an outbox row and lists only pending", async () => {
    for (const m of seed.members) await repos.members.insert(m);
    const pending = seed.outbox.find((o) => o.sentAt === null)!;
    const sent = { ...seed.outbox.find((o) => o.sentAt !== null)!, id: "out_sent" };
    await repos.outbox.insert(pending);
    await repos.outbox.insert(sent);
    const list = await repos.outbox.listPending();
    expect(list.every((o) => o.sentAt === null)).toBe(true);
    expect(list.map((o) => o.id)).toContain(pending.id);
    const marked = await repos.outbox.update(pending.id, {
      sentAt: NOW.toISOString(),
      providerMessageId: "re_1",
    });
    expect(marked.sentAt).toBe(NOW.toISOString());
    expect((await repos.outbox.listPending()).map((o) => o.id)).not.toContain(pending.id);
  });
});
