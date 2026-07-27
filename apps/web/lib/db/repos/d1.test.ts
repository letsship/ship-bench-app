import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createD1Repositories } from "./d1";
import { createInMemoryRepositories } from "./fakes";
import type { Repositories } from "./types";

// Parity test for the production D1 adapter. `migrations/0001_init.sql` is
// applied to an in-process SQLite database (node:sqlite — a Node built-in, so
// the suite stays hermetic and native-module free), wrapped in a minimal
// D1Database-compatible shim, and driven through `createD1Repositories`. Every
// assertion compares against the in-memory fakes running on the same seed, so
// the two implementations are held to identical behaviour.

// --- Minimal D1Database shim over node:sqlite ------------------------------
// Drizzle's D1 session only uses `prepare(sql)`, `bind(...params)`, and then
// `all()` / `raw()` / `run()` on the bound statement.

class ShimStatement {
  constructor(
    private readonly stmt: StatementSync,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): ShimStatement {
    return new ShimStatement(this.stmt, params);
  }

  private read(asArrays: boolean): unknown[] {
    this.stmt.setReturnArrays(asArrays);
    try {
      return this.stmt.all(...(this.params as never[]));
    } finally {
      this.stmt.setReturnArrays(false);
    }
  }

  async all(): Promise<{ success: true; results: unknown[] }> {
    return { success: true, results: this.read(false) };
  }

  async raw(): Promise<unknown[]> {
    return this.read(true);
  }

  async run(): Promise<{ success: true; results: unknown[] }> {
    this.stmt.run(...(this.params as never[]));
    return { success: true, results: [] };
  }
}

function createShim(db: DatabaseSync): D1Database {
  return {
    prepare: (sql: string) => new ShimStatement(db.prepare(sql)),
  } as unknown as D1Database;
}

const MIGRATION = resolve(__dirname, "../../../migrations/0001_init.sql");

const seed = buildSeed();

function insertSeedStudio(db: DatabaseSync): void {
  const { studio, settings } = seed;
  db.prepare(
    "insert into studios (id, name, slug, timezone, created_at) values (?, ?, ?, ?, ?)",
  ).run(studio.id, studio.name, studio.slug, studio.timezone, studio.createdAt);
  db.prepare(
    `insert into studio_settings (studio_id, currency, tax_rate_bps, cancellation_window_hours,
       waitlist_enabled, notify_booking_confirmations, notify_cancellations,
       notify_waitlist_promotions, notify_invoices)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    settings.studioId,
    settings.currency,
    settings.taxRateBps,
    settings.cancellationWindowHours,
    Number(settings.waitlistEnabled),
    Number(settings.notifyBookingConfirmations),
    Number(settings.notifyCancellations),
    Number(settings.notifyWaitlistPromotions),
    Number(settings.notifyInvoices),
  );
}

// Load the demo dataset through the repository seam itself, so the writes under
// test are the ones producing the rows the reads are asserted against.
async function loadSeed(repos: Repositories): Promise<void> {
  for (const member of seed.members) await repos.members.insert(member);
  for (const classType of seed.classTypes) await repos.classTypes.insert(classType);
  for (const session of seed.sessions) await repos.classSessions.insert(session);
  for (const booking of seed.bookings) await repos.bookings.insert(booking);
  for (const invoice of seed.invoices) await repos.invoices.insert(invoice);
  await repos.invoiceLineItems.insertMany(seed.lineItems);
  for (const row of seed.outbox) await repos.outbox.insert(row);
}

describe("createD1Repositories", () => {
  let repos: Repositories;
  let fakes: Repositories;

  beforeEach(async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readFileSync(MIGRATION, "utf8"));
    insertSeedStudio(db);

    repos = createD1Repositories(createShim(db));
    await loadSeed(repos);

    // The fakes get the studio + settings from the seed and the rest through the
    // same inserts, so both sides start from an identical dataset.
    fakes = createInMemoryRepositories({
      ...seed,
      members: [],
      classTypes: [],
      sessions: [],
      bookings: [],
      invoices: [],
      lineItems: [],
      outbox: [],
    });
    await loadSeed(fakes);
  });

  it("reads the studio and its settings", async () => {
    expect(await repos.studios.getFirst()).toEqual(await fakes.studios.getFirst());
    expect(await repos.settings.getByStudioId(seed.studio.id)).toEqual(
      await fakes.settings.getByStudioId(seed.studio.id),
    );
  });

  it("round-trips a settings update, preserving booleans", async () => {
    const patch = { waitlistEnabled: false, cancellationWindowHours: 24 };
    expect(await repos.settings.update(seed.studio.id, patch)).toEqual(
      await fakes.settings.update(seed.studio.id, patch),
    );
    expect((await repos.settings.getByStudioId(seed.studio.id))?.waitlistEnabled).toBe(false);
  });

  it("lists members by studio ordered by name, with nullable columns intact", async () => {
    const listed = await repos.members.listByStudio(seed.studio.id);
    expect(listed).toEqual(await fakes.members.listByStudio(seed.studio.id));
    expect(listed.map((row) => row.name)).toEqual(
      [...listed].map((row) => row.name).sort((a, b) => a.localeCompare(b)),
    );
    expect(listed.some((row) => row.phone === null)).toBe(true);
  });

  it("finds a member by id and by email, and returns null when absent", async () => {
    const member = seed.members[0]!;
    expect(await repos.members.getById(member.id)).toEqual(member);
    expect(await repos.members.findByEmail(seed.studio.id, member.email)).toEqual(member);
    expect(await repos.members.getById("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await repos.members.findByEmail(seed.studio.id, "nobody@example.com")).toBeNull();
  });

  it("returns the full row from insert and update", async () => {
    const member = {
      ...seed.members[0]!,
      id: "11111111-1111-4111-8111-111111111111",
      email: "new@example.com",
      phone: null,
    };
    expect(await repos.members.insert(member)).toEqual(await fakes.members.insert(member));

    const patch = { status: "paused", notificationsOptedOut: true };
    expect(await repos.members.update(member.id, patch)).toEqual(
      await fakes.members.update(member.id, patch),
    );
  });

  it("filters class sessions by the starts_at range and orders by starts_at", async () => {
    const all = await repos.classSessions.listByStudio(seed.studio.id);
    expect(all).toEqual(await fakes.classSessions.listByStudio(seed.studio.id));

    const from = all[1]!.startsAt;
    const to = all[all.length - 1]!.startsAt;
    const range = { from, to };
    const windowed = await repos.classSessions.listByStudio(seed.studio.id, range);
    expect(windowed).toEqual(await fakes.classSessions.listByStudio(seed.studio.id, range));
    expect(windowed[0]!.startsAt).toBe(from);
    expect(windowed.every((row) => row.startsAt >= from && row.startsAt < to)).toBe(true);
  });

  it("lists bookings by session ids and short-circuits on empty input", async () => {
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);

    const sessionIds = seed.sessions.slice(0, 3).map((row) => row.id);
    const listed = await repos.bookings.listBySessionIds(sessionIds);
    expect(sortById(listed)).toEqual(sortById(await fakes.bookings.listBySessionIds(sessionIds)));

    const sessionId = sessionIds[0]!;
    expect(sortById(await repos.bookings.listBySession(sessionId))).toEqual(
      sortById(await fakes.bookings.listBySession(sessionId)),
    );
  });

  it("cancels a booking through update", async () => {
    const booking = seed.bookings[0]!;
    const patch = { status: "cancelled", cancelledAt: "2026-07-01T10:00:00.000Z" };
    expect(await repos.bookings.update(booking.id, patch)).toEqual(
      await fakes.bookings.update(booking.id, patch),
    );
    expect(await repos.bookings.getById(booking.id)).toEqual(
      await fakes.bookings.getById(booking.id),
    );
  });

  it("lists invoices newest-issued first and counts them by studio", async () => {
    expect(await repos.invoices.listByStudio(seed.studio.id)).toEqual(
      await fakes.invoices.listByStudio(seed.studio.id),
    );
    expect(await repos.invoices.countByStudio(seed.studio.id)).toBe(
      await fakes.invoices.countByStudio(seed.studio.id),
    );
    expect(await repos.invoices.countByStudio("00000000-0000-0000-0000-000000000000")).toBe(0);
  });

  it("stores invoice line items with their boolean and nullable columns", async () => {
    const invoiceId = seed.lineItems[0]!.invoiceId;
    expect(sortById(await repos.invoiceLineItems.listByInvoice(invoiceId))).toEqual(
      sortById(await fakes.invoiceLineItems.listByInvoice(invoiceId)),
    );
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("lists only unsent outbox rows and clears them on update", async () => {
    const pending = await repos.outbox.listPending();
    expect(sortById(pending)).toEqual(sortById(await fakes.outbox.listPending()));

    const patch = { sentAt: "2026-07-01T10:00:00.000Z", providerMessageId: "msg_1" };
    const row = pending[0]!;
    expect(await repos.outbox.update(row.id, patch)).toEqual(
      await fakes.outbox.update(row.id, patch),
    );
    expect(await repos.outbox.listPending()).toHaveLength(pending.length - 1);
  });
});

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}
