// Contract tests for the D1 (Drizzle-over-SQLite) repository adapter.
//
// These run in the standard node vitest environment — NOT in a Worker. To drive
// `createD1Repositories` unchanged, we stand up an in-memory SQLite database
// with Node's built-in `node:sqlite` (`DatabaseSync`, compiled into Node 22+ —
// no native addon to build, no wasm to load), apply the real D1 migration
// (`migrations/0001_init.sql`), and wrap it in a minimal `D1Database`-compatible
// shim that translates Drizzle's `prepare().bind().all()/run()/raw()` calls onto
// `node:sqlite`. That exercises the production adapter against a real SQLite
// engine without pulling in Miniflare, `@cloudflare/vitest-pool-workers`, or a
// native module like `better-sqlite3` (whose prebuilt binding is not reliably
// available across CI runners). `node:sqlite` is experimental but stable enough
// for this in-memory contract suite; it emits a warning to stderr only.

import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync, type StatementSync, type StatementResultingChanges } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeed, SEED_NOW } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";
import type { Studio, StudioSettings } from "../types";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(HERE, "../../../migrations");
const INIT_SQL = readFileSync(resolve(MIGRATIONS, "0001_init.sql"), "utf8");

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

// A minimal D1Database shim over `node:sqlite`. Drizzle's D1 driver only uses
// `prepare(sql).bind(...params).all()/.run()/.raw()` (plus `batch`/`exec` for
// completeness), so that is all we implement. `node:sqlite` returns rows as
// objects keyed by column name (snake_case), exactly what Drizzle's field
// mapping expects.
class D1PreparedStatement {
  constructor(
    private readonly stmt: StatementSync,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new D1PreparedStatement(this.stmt, values);
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const results = this.stmt.all(...(this.params as never)) as T[];
    return { results, success: true, meta: {} };
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    const info = this.stmt.run(...(this.params as never)) as StatementResultingChanges;
    return {
      results: [],
      success: true,
      meta: { changes: info.changes, last_insert_rowid: info.lastInsertRowid },
    };
  }

  async first<T = unknown>(): Promise<T | null> {
    return (this.stmt.get(...(this.params as never)) as T | undefined) ?? null;
  }

  async raw<T = unknown>(options?: { columnNames?: boolean }): Promise<T[]> {
    const cols = this.stmt.columns().map((c) => c.name);
    const rows = this.stmt.all(...(this.params as never)) as Record<string, unknown>[];
    const valueRows = rows.map((r) => cols.map((c) => r[c]));
    if (options?.columnNames) return [cols, ...valueRows] as unknown as T[];
    return valueRows as unknown as T[];
  }
}

class D1DatabaseShim {
  constructor(private readonly db: DatabaseSync) {}

  prepare(query: string): D1PreparedStatement {
    return new D1PreparedStatement(this.db.prepare(query));
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.all(statements.map((s) => s.run<T>()));
  }

  async exec(query: string): Promise<unknown> {
    this.db.exec(query);
    return {};
  }

  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }
}

interface TestHandle {
  repos: Repositories;
  sqlite: DatabaseSync;
}

function createTestRepositories(): TestHandle {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(INIT_SQL);
  const repos = createD1Repositories(new D1DatabaseShim(sqlite) as unknown as D1Database);
  return { repos, sqlite };
}

// `studio_settings` + `studios` are seeded once (the repo interfaces only
// expose `studios.getFirst` and `settings.getByStudioId`/`update` — no insert),
// so insert their seed rows directly via SQL — mirroring what the 0002_seed
// migration does in production.
function insertStudio(sqlite: DatabaseSync, studio: Studio): void {
  sqlite
    .prepare(
      `insert into studios (id, name, slug, timezone, created_at) values (?, ?, ?, ?, ?)`,
    )
    .run(studio.id, studio.name, studio.slug, studio.timezone, studio.createdAt);
}

function insertSettings(sqlite: DatabaseSync, settings: StudioSettings): void {
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
}

describe("D1 repositories (Drizzle over SQLite)", () => {
  let repos: Repositories;
  let sqlite: DatabaseSync;
  let studioId: string;

  beforeEach(async () => {
    const handle = createTestRepositories();
    repos = handle.repos;
    sqlite = handle.sqlite;
    const seed = buildSeed(SEED_NOW);
    studioId = seed.studio.id;
    insertStudio(sqlite, seed.studio);
    insertSettings(sqlite, seed.settings);
    for (const member of seed.members) await repos.members.insert(member);
    for (const ct of seed.classTypes) await repos.classTypes.insert(ct);
    for (const s of seed.sessions) await repos.classSessions.insert(s);
    for (const b of seed.bookings) await repos.bookings.insert(b);
    for (const inv of seed.invoices) {
      await repos.invoices.insert(inv);
      const lines = seed.lineItems.filter((l) => l.invoiceId === inv.id);
      await repos.invoiceLineItems.insertMany(lines);
    }
    for (const row of seed.outbox) await repos.outbox.insert(row);
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.id).toBe(studioId);
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
    expect(settings?.waitlistEnabled).toBe(true);
    expect(typeof settings?.waitlistEnabled).toBe("boolean");
  });

  it("lists members sorted by name", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(members.length).toBeGreaterThan(0);
    // Boolean column round-trips as a real boolean (Drizzle integer-boolean mode).
    expect(typeof members[0].notificationsOptedOut).toBe("boolean");
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

  it("lists sessions ordered by startsAt", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const starts = sessions.map((s) => s.startsAt);
    expect(starts).toEqual([...starts].sort((a, b) => a.localeCompare(b)));
  });

  it("lists bookings across multiple session ids (and short-circuits empty)", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
  });

  it("counts invoices for the studio and lists them issuedAt desc", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
    const issued = list.map((i) => i.issuedAt);
    expect(issued).toEqual([...issued].sort((a, b) => b.localeCompare(a)));
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("invoiceLineItems.insertMany short-circuits on empty", async () => {
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
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
      createdAt: SEED_NOW.toISOString(),
    };
    await repos.members.insert(member);
    expect(await repos.members.getById("mem_new")).toEqual(member);
  });

  it("update returns an isolated clone (store not mutated by reference)", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    expect(updated.status).toBe("paused");
    updated.status = "active"; // mutate the returned object
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("settings.update round-trips a patch", async () => {
    const updated = await repos.settings.update(studioId, { taxRateBps: 1234 });
    expect(updated.taxRateBps).toBe(1234);
    const refetched = await repos.settings.getByStudioId(studioId);
    expect(refetched?.taxRateBps).toBe(1234);
  });

  it("update throws when the row does not exist", async () => {
    await expect(repos.members.update("missing", { status: "x" })).rejects.toThrow();
  });

  it("empty repositories return nulls / empty lists", async () => {
    const handle = createTestRepositories();
    expect(await handle.repos.studios.getFirst()).toBeNull();
    expect(await handle.repos.members.listByStudio("x")).toEqual([]);
    expect(await handle.repos.invoices.countByStudio("x")).toBe(0);
    expect(await handle.repos.outbox.listPending()).toEqual([]);
  });
});
