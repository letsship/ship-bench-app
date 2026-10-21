import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Repositories } from "./types";
import { createD1Repositories } from "./d1";

// Parity suite for the Drizzle-over-D1 production adapter. Runs against a real
// local D1 instance provided by wrangler's getPlatformProxy (miniflare-backed,
// non-persistent), with the shipped migration SQL applied — the same DDL a
// fresh `wrangler d1 migrations apply` would run.

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(here, "../../../migrations/0001_init.sql");

const TS = "2026-01-05T09:00:00.000Z";
const STUDIO_ID = "studio-1";
const MEMBER_ZED = "member-zed";
const MEMBER_ANA = "member-ana";
const CLASS_TYPE_ID = "class-type-1";

let repos: Repositories;
let db: D1Database;
let dispose: () => Promise<void>;
let workDir: string;

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), "studiobook-d1-test-"));
  writeFileSync(
    join(workDir, "wrangler.jsonc"),
    JSON.stringify({
      name: "studiobook-d1-test",
      compatibility_date: "2025-06-01",
      d1_databases: [{ binding: "DB", database_name: "studiobook", database_id: "d1-test" }],
    }),
  );
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: join(workDir, "wrangler.jsonc"),
    persist: false,
  });
  dispose = proxy.dispose;
  db = proxy.env.DB;
  // Apply the shipped migration statement-by-statement (the local D1 batch
  // parser is picky about comments and multi-statement input).
  const migrationSql = readFileSync(migrationPath, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  for (const statement of migrationSql.split(";")) {
    if (statement.trim()) await proxy.env.DB.prepare(statement).run();
  }
  repos = createD1Repositories(proxy.env.DB);

  await repos.studios;
  await seed();
});

afterAll(async () => {
  await dispose();
  rmSync(workDir, { recursive: true, force: true });
});

async function seed(): Promise<void> {
  // FK constraints are enforced by D1, so seed parents before children.
  await db.prepare(
    `INSERT INTO studios (id, name, slug, timezone, created_at)
     VALUES ('${STUDIO_ID}', 'Test Studio', 'test-studio', 'UTC', '${TS}'),
            ('studio-2', 'Other Studio', 'other-studio', 'UTC', '${TS}')`,
  ).run();
  await db.prepare(
    `INSERT INTO members (id, studio_id, name, email, phone, status, notifications_opted_out, created_at)
     VALUES ('${MEMBER_ZED}', '${STUDIO_ID}', 'Zed', 'zed@example.com', NULL, 'active', 0, '${TS}'),
            ('${MEMBER_ANA}', '${STUDIO_ID}', 'Ana', 'ana@example.com', '+15551234567', 'active', 1, '${TS}')`,
  ).run();
  await db.prepare(
    `INSERT INTO class_types (id, studio_id, name, description, color, default_capacity, default_price_cents, created_at)
     VALUES ('${CLASS_TYPE_ID}', '${STUDIO_ID}', 'Yoga', NULL, '#000000', 10, 1500, '${TS}')`,
  ).run();
  await db.prepare(
    `INSERT INTO class_sessions (id, studio_id, class_type_id, instructor, starts_at, ends_at, capacity, price_cents, status, created_at)
     VALUES ('session-early', '${STUDIO_ID}', '${CLASS_TYPE_ID}', 'Sam', '2026-01-10T09:00:00.000Z', '2026-01-10T10:00:00.000Z', 10, 1500, 'scheduled', '${TS}'),
            ('session-late', '${STUDIO_ID}', '${CLASS_TYPE_ID}', 'Sam', '2026-01-20T09:00:00.000Z', '2026-01-20T10:00:00.000Z', 10, 1500, 'scheduled', '${TS}')`,
  ).run();
}

describe("createD1Repositories", () => {
  it("round-trips inserts and reads through every repository", async () => {
    const member = await repos.members.insert({
      id: "member-new",
      studioId: STUDIO_ID,
      name: "New",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: TS,
    });
    expect(member).toEqual({
      id: "member-new",
      studioId: STUDIO_ID,
      name: "New",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: TS,
    });
    expect(await repos.members.getById("member-new")).toEqual(member);
    expect(await repos.members.getById("missing")).toBeNull();
    expect(await repos.members.findByEmail(STUDIO_ID, "new@example.com")).toEqual(member);
    expect(await repos.members.findByEmail(STUDIO_ID, "nobody@example.com")).toBeNull();

    const updated = await repos.members.update("member-new", { status: "suspended" });
    expect(updated.status).toBe("suspended");
  });

  it("reads back boolean columns as booleans", async () => {
    const zed = await repos.members.getById(MEMBER_ZED);
    const ana = await repos.members.getById(MEMBER_ANA);
    expect(zed?.notificationsOptedOut).toBe(false);
    expect(ana?.notificationsOptedOut).toBe(true);
  });

  it("lists members by studio ordered by name", async () => {
    const members = await repos.members.listByStudio(STUDIO_ID);
    expect(members.map((m) => m.name)).toEqual(["Ana", "New", "Zed"]);
    expect(await repos.members.listByStudio("studio-2")).toEqual([]);
  });

  it("lists studios via getFirst", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.id).toBe(STUDIO_ID);
  });

  it("lists class types ordered by name and class sessions by startsAt", async () => {
    const types = await repos.classTypes.listByStudio(STUDIO_ID);
    expect(types.map((t) => t.name)).toEqual(["Yoga"]);
    expect(await repos.classTypes.getById(CLASS_TYPE_ID)).toEqual(types[0]);

    const sessions = await repos.classSessions.listByStudio(STUDIO_ID);
    expect(sessions.map((s) => s.id)).toEqual(["session-early", "session-late"]);
  });

  it("applies the optional startsAt range filter (from inclusive, to exclusive)", async () => {
    const from = await repos.classSessions.listByStudio(STUDIO_ID, {
      from: "2026-01-15T00:00:00.000Z",
    });
    expect(from.map((s) => s.id)).toEqual(["session-late"]);

    const to = await repos.classSessions.listByStudio(STUDIO_ID, {
      to: "2026-01-15T00:00:00.000Z",
    });
    expect(to.map((s) => s.id)).toEqual(["session-early"]);

    const both = await repos.classSessions.listByStudio(STUDIO_ID, {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-15T00:00:00.000Z",
    });
    expect(both.map((s) => s.id)).toEqual(["session-early"]);
  });

  it("handles bookings: empty session-id list, insert, list, update", async () => {
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);

    const booking = await repos.bookings.insert({
      id: "booking-1",
      sessionId: "session-early",
      memberId: MEMBER_ANA,
      status: "booked",
      bookedAt: TS,
      cancelledAt: null,
    });
    expect(booking.status).toBe("booked");
    expect(await repos.bookings.getById("booking-1")).toEqual(booking);
    expect((await repos.bookings.listBySession("session-early")).map((b) => b.id)).toEqual([
      "booking-1",
    ]);
    expect(
      (await repos.bookings.listBySessionIds(["session-early", "session-late"])).map((b) => b.id),
    ).toEqual(["booking-1"]);

    const cancelled = await repos.bookings.update("booking-1", {
      status: "cancelled",
      cancelledAt: TS,
    });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toBe(TS);
  });

  it("lists invoices ordered by issuedAt desc and counts by studio", async () => {
    const base = {
      studioId: STUDIO_ID,
      memberId: MEMBER_ZED,
      status: "issued",
      currency: "EUR",
      taxRateBps: 0,
      subtotalCents: 1000,
      taxCents: 0,
      totalCents: 1000,
      dueAt: null,
      paidAt: null,
      createdAt: TS,
    };
    await repos.invoices.insert({ ...base, id: "inv-old", number: "INV-1", issuedAt: TS });
    await repos.invoices.insert({
      ...base,
      id: "inv-new",
      number: "INV-2",
      issuedAt: "2026-02-01T09:00:00.000Z",
    });

    const invoices = await repos.invoices.listByStudio(STUDIO_ID);
    expect(invoices.map((i) => i.id)).toEqual(["inv-new", "inv-old"]);
    expect(await repos.invoices.countByStudio(STUDIO_ID)).toBe(2);
    expect(await repos.invoices.countByStudio("studio-2")).toBe(0);

    const paid = await repos.invoices.update("inv-new", {
      status: "paid",
      paidAt: "2026-02-02T09:00:00.000Z",
    });
    expect(paid.status).toBe("paid");
  });

  it("handles invoice line items including the empty insertMany guard", async () => {
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);

    const items = await repos.invoiceLineItems.insertMany([
      {
        id: "item-1",
        invoiceId: "inv-new",
        description: "Yoga class",
        quantity: 1,
        unitAmountCents: 1000,
        amountCents: 1000,
        refunded: false,
        bookingId: null,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].refunded).toBe(false);
    expect((await repos.invoiceLineItems.listByInvoice("inv-new")).map((i) => i.id)).toEqual([
      "item-1",
    ]);
  });

  it("lists outbox rows pending send (sentAt IS NULL) and updates them", async () => {
    const pending = await repos.outbox.insert({
      id: "outbox-pending",
      memberId: MEMBER_ANA,
      kind: "booking_confirmation",
      payload: "{}",
      createdAt: TS,
      sentAt: null,
      providerMessageId: null,
      error: null,
    });
    expect(pending.sentAt).toBeNull();

    const sent = await repos.outbox.update("outbox-pending", {
      sentAt: TS,
      providerMessageId: "msg-1",
    });
    expect(sent.sentAt).toBe(TS);
    expect(await repos.outbox.listPending()).toEqual([]);

    await repos.outbox.insert({
      id: "outbox-new",
      memberId: MEMBER_ANA,
      kind: "invoice_issued",
      payload: "{}",
      createdAt: TS,
      sentAt: null,
      providerMessageId: null,
      error: null,
    });
    expect((await repos.outbox.listPending()).map((r) => r.id)).toEqual(["outbox-new"]);
  });
});
