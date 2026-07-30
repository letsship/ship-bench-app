import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  InvoiceLineItem,
  Member,
  NotificationOutboxRow,
  Studio,
  StudioSettings,
} from "../types";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// `createD1Repositories` is exercised against a real SQLite database created
// from the shipped wrangler migration, driven through a minimal shim of the D1
// binding API that Drizzle's D1 driver uses (prepare → bind → raw/all/run).
// That keeps the suite hermetic (no wrangler, no miniflare, no network) while
// still proving the adapter, the Drizzle schema, and migrations/0001_init.sql
// agree with each other and produce the same entity shapes as the fakes.

type SqlParam = string | number | null;

const MIGRATION_SQL = readFileSync(
  fileURLToPath(new URL("../../../migrations/0001_init.sql", import.meta.url)),
  "utf8",
);

type D1Binding = Parameters<typeof createD1Repositories>[0];

interface TestDatabase {
  binding: D1Binding;
  exec(sql: string, ...params: SqlParam[]): void;
}

function createSqliteD1(): TestDatabase {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(MIGRATION_SQL);

  const bound = (sql: string, params: SqlParam[]) => ({
    all: async () => ({ success: true, results: sqlite.prepare(sql).all(...params) }),
    // D1 hands each row back as an array of values in SELECT order; node:sqlite
    // builds its row objects in that same order, so Object.values lines up.
    raw: async () =>
      sqlite
        .prepare(sql)
        .all(...params)
        .map((row) => Object.values(row)),
    run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...params) }),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
  });

  return {
    binding: {
      prepare: (sql: string) => ({
        ...bound(sql, []),
        bind: (...params: SqlParam[]) => bound(sql, params),
      }),
    } as unknown as D1Binding,
    exec: (sql, ...params) => {
      sqlite.prepare(sql).run(...params);
    },
  };
}

const STUDIO: Studio = {
  id: "studio-1",
  name: "Northside Studio",
  slug: "northside",
  timezone: "Europe/Berlin",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const SETTINGS: StudioSettings = {
  studioId: STUDIO.id,
  currency: "EUR",
  taxRateBps: 1900,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: false,
  notifyWaitlistPromotions: true,
  notifyInvoices: false,
};

const member = (id: string, name: string, email: string, phone: string | null = null): Member => ({
  id,
  studioId: STUDIO.id,
  name,
  email,
  phone,
  status: "active",
  notificationsOptedOut: false,
  createdAt: "2026-01-02T00:00:00.000Z",
});

const CLASS_TYPE: ClassType = {
  id: "type-1",
  studioId: STUDIO.id,
  name: "Vinyasa",
  description: null,
  color: "#6b7280",
  defaultCapacity: 12,
  defaultPriceCents: 1800,
  createdAt: "2026-01-02T00:00:00.000Z",
};

const session = (id: string, startsAt: string, endsAt: string): ClassSession => ({
  id,
  studioId: STUDIO.id,
  classTypeId: CLASS_TYPE.id,
  instructor: "Ada",
  startsAt,
  endsAt,
  capacity: 10,
  priceCents: 1800,
  status: "scheduled",
  createdAt: "2026-01-02T00:00:00.000Z",
});

const booking = (id: string, sessionId: string, memberId: string): Booking => ({
  id,
  sessionId,
  memberId,
  status: "booked",
  bookedAt: "2026-01-03T09:00:00.000Z",
  cancelledAt: null,
});

const invoice = (id: string, number: string, issuedAt: string, memberId: string): Invoice => ({
  id,
  studioId: STUDIO.id,
  memberId,
  number,
  status: "open",
  currency: "EUR",
  taxRateBps: 1900,
  subtotalCents: 1800,
  taxCents: 342,
  totalCents: 2142,
  issuedAt,
  dueAt: null,
  paidAt: null,
  createdAt: issuedAt,
});

const lineItem = (id: string, invoiceId: string, bookingId: string | null): InvoiceLineItem => ({
  id,
  invoiceId,
  description: "Vinyasa drop-in",
  quantity: 1,
  unitAmountCents: 1800,
  amountCents: 1800,
  refunded: false,
  bookingId,
});

const outboxRow = (id: string, memberId: string, sentAt: string | null): NotificationOutboxRow => ({
  id,
  memberId,
  kind: "booking_confirmation",
  payload: '{"subject":"Booked"}',
  createdAt: "2026-01-03T09:00:00.000Z",
  sentAt,
  providerMessageId: null,
  error: null,
});

describe("createD1Repositories", () => {
  let db: TestDatabase;
  let repos: Repositories;

  // `studios` / `studio_settings` are read-only on the repository seam (the seed
  // owns them), so the fixture rows go in through the test database directly.
  const seedStudio = (): void => {
    db.exec(
      "insert into studios (id, name, slug, timezone, created_at) values (?, ?, ?, ?, ?)",
      STUDIO.id,
      STUDIO.name,
      STUDIO.slug,
      STUDIO.timezone,
      STUDIO.createdAt,
    );
    db.exec(
      `insert into studio_settings (
         studio_id, currency, tax_rate_bps, cancellation_window_hours, waitlist_enabled,
         notify_booking_confirmations, notify_cancellations, notify_waitlist_promotions, notify_invoices
       ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      SETTINGS.studioId,
      SETTINGS.currency,
      SETTINGS.taxRateBps,
      SETTINGS.cancellationWindowHours,
      Number(SETTINGS.waitlistEnabled),
      Number(SETTINGS.notifyBookingConfirmations),
      Number(SETTINGS.notifyCancellations),
      Number(SETTINGS.notifyWaitlistPromotions),
      Number(SETTINGS.notifyInvoices),
    );
  };

  beforeEach(() => {
    db = createSqliteD1();
    repos = createD1Repositories(db.binding);
  });

  it("returns the whole repository surface", () => {
    expect(Object.keys(repos).sort()).toEqual(
      [
        "bookings",
        "classSessions",
        "classTypes",
        "invoiceLineItems",
        "invoices",
        "members",
        "outbox",
        "settings",
        "studios",
      ].sort(),
    );
    expect(Object.keys(repos.studios)).toEqual(["getFirst"]);
    expect(Object.keys(repos.settings).sort()).toEqual(["getByStudioId", "update"]);
    expect(Object.keys(repos.members).sort()).toEqual(
      ["findByEmail", "getById", "insert", "listByStudio", "update"].sort(),
    );
    expect(Object.keys(repos.classTypes).sort()).toEqual(["getById", "insert", "listByStudio"]);
    expect(Object.keys(repos.classSessions).sort()).toEqual(["getById", "insert", "listByStudio"]);
    expect(Object.keys(repos.bookings).sort()).toEqual(
      ["getById", "insert", "listBySession", "listBySessionIds", "update"].sort(),
    );
    expect(Object.keys(repos.invoices).sort()).toEqual(
      ["countByStudio", "getById", "insert", "listByStudio", "update"].sort(),
    );
    expect(Object.keys(repos.invoiceLineItems).sort()).toEqual(["insertMany", "listByInvoice"]);
    expect(Object.keys(repos.outbox).sort()).toEqual(["insert", "listPending", "update"]);
  });

  describe("studios and settings", () => {
    it("reads back the first studio, or null when empty", async () => {
      expect(await repos.studios.getFirst()).toBeNull();
      seedStudio();
      expect(await repos.studios.getFirst()).toEqual(STUDIO);
    });

    it("round-trips settings booleans as real booleans", async () => {
      seedStudio();
      expect(await repos.settings.getByStudioId(STUDIO.id)).toEqual(SETTINGS);
      expect(await repos.settings.getByStudioId("missing")).toBeNull();
    });

    it("updates settings and returns the updated row", async () => {
      seedStudio();
      const updated = await repos.settings.update(STUDIO.id, {
        waitlistEnabled: false,
        cancellationWindowHours: 24,
      });
      expect(updated).toEqual({ ...SETTINGS, waitlistEnabled: false, cancellationWindowHours: 24 });
    });

    it("treats an empty settings patch as a no-op read", async () => {
      seedStudio();
      expect(await repos.settings.update(STUDIO.id, {})).toEqual(SETTINGS);
    });
  });

  describe("members", () => {
    beforeEach(async () => {
      seedStudio();
      await repos.members.insert(member("m-2", "Zoe", "zoe@example.com", "+49 30 1234"));
      await repos.members.insert(member("m-1", "Ada", "ada@example.com"));
    });

    it("lists a studio's members ordered by name", async () => {
      expect((await repos.members.listByStudio(STUDIO.id)).map((row) => row.name)).toEqual([
        "Ada",
        "Zoe",
      ]);
    });

    it("preserves null and boolean fields", async () => {
      expect(await repos.members.getById("m-1")).toEqual(member("m-1", "Ada", "ada@example.com"));
      expect(await repos.members.getById("nope")).toBeNull();
    });

    it("finds a member by studio + email", async () => {
      expect(await repos.members.findByEmail(STUDIO.id, "zoe@example.com")).toMatchObject({
        id: "m-2",
        phone: "+49 30 1234",
      });
      expect(await repos.members.findByEmail("other-studio", "zoe@example.com")).toBeNull();
      expect(await repos.members.findByEmail(STUDIO.id, "nobody@example.com")).toBeNull();
    });

    it("updates a member and returns the new row", async () => {
      const updated = await repos.members.update("m-1", {
        status: "paused",
        notificationsOptedOut: true,
      });
      expect(updated).toMatchObject({ status: "paused", notificationsOptedOut: true });
    });

    it("wraps driver errors with the repository context", async () => {
      await expect(
        repos.members.insert(member("m-3", "Ada II", "ada@example.com")),
      ).rejects.toThrow(/^D1 members\.insert failed: /);
    });

    it("fails loudly when the updated row does not exist", async () => {
      await expect(repos.members.update("ghost", { status: "paused" })).rejects.toThrow(
        /^D1 members\.update failed: no row returned$/,
      );
    });
  });

  describe("class types and sessions", () => {
    beforeEach(async () => {
      seedStudio();
      await repos.classTypes.insert(CLASS_TYPE);
      await repos.classSessions.insert(
        session("s-2", "2026-02-02T10:00:00.000Z", "2026-02-02T11:00:00.000Z"),
      );
      await repos.classSessions.insert(
        session("s-1", "2026-02-01T10:00:00.000Z", "2026-02-01T11:00:00.000Z"),
      );
      await repos.classSessions.insert(
        session("s-3", "2026-02-03T10:00:00.000Z", "2026-02-03T11:00:00.000Z"),
      );
    });

    it("lists class types ordered by name and reads one by id", async () => {
      expect(await repos.classTypes.listByStudio(STUDIO.id)).toEqual([CLASS_TYPE]);
      expect(await repos.classTypes.getById(CLASS_TYPE.id)).toEqual(CLASS_TYPE);
      expect(await repos.classTypes.getById("nope")).toBeNull();
    });

    it("orders sessions by start time", async () => {
      expect((await repos.classSessions.listByStudio(STUDIO.id)).map((row) => row.id)).toEqual([
        "s-1",
        "s-2",
        "s-3",
      ]);
    });

    it("applies an inclusive `from` and an exclusive `to` bound", async () => {
      const ids = async (range: { from?: string; to?: string }) =>
        (await repos.classSessions.listByStudio(STUDIO.id, range)).map((row) => row.id);

      expect(await ids({ from: "2026-02-02T10:00:00.000Z" })).toEqual(["s-2", "s-3"]);
      expect(await ids({ to: "2026-02-02T10:00:00.000Z" })).toEqual(["s-1"]);
      expect(
        await ids({ from: "2026-02-01T10:00:00.000Z", to: "2026-02-03T10:00:00.000Z" }),
      ).toEqual(["s-1", "s-2"]);
    });

    it("reads a session by id", async () => {
      expect(await repos.classSessions.getById("s-1")).toMatchObject({ instructor: "Ada" });
      expect(await repos.classSessions.getById("nope")).toBeNull();
    });
  });

  describe("bookings", () => {
    beforeEach(async () => {
      seedStudio();
      await repos.members.insert(member("m-1", "Ada", "ada@example.com"));
      await repos.classTypes.insert(CLASS_TYPE);
      await repos.classSessions.insert(
        session("s-1", "2026-02-01T10:00:00.000Z", "2026-02-01T11:00:00.000Z"),
      );
      await repos.classSessions.insert(
        session("s-2", "2026-02-02T10:00:00.000Z", "2026-02-02T11:00:00.000Z"),
      );
      await repos.bookings.insert(booking("b-1", "s-1", "m-1"));
      await repos.bookings.insert(booking("b-2", "s-2", "m-1"));
    });

    it("short-circuits an empty session id list without querying", async () => {
      expect(await repos.bookings.listBySessionIds([])).toEqual([]);
    });

    it("lists bookings for several sessions", async () => {
      const rows = await repos.bookings.listBySessionIds(["s-1", "s-2", "s-missing"]);
      expect(rows.map((row) => row.id).sort()).toEqual(["b-1", "b-2"]);
    });

    it("lists bookings for one session and reads one by id", async () => {
      expect(await repos.bookings.listBySession("s-1")).toEqual([booking("b-1", "s-1", "m-1")]);
      expect(await repos.bookings.getById("b-1")).toEqual(booking("b-1", "s-1", "m-1"));
      expect(await repos.bookings.getById("nope")).toBeNull();
    });

    it("cancels a booking", async () => {
      const updated = await repos.bookings.update("b-1", {
        status: "cancelled",
        cancelledAt: "2026-02-01T08:00:00.000Z",
      });
      expect(updated).toEqual({
        ...booking("b-1", "s-1", "m-1"),
        status: "cancelled",
        cancelledAt: "2026-02-01T08:00:00.000Z",
      });
    });
  });

  describe("invoices and line items", () => {
    beforeEach(async () => {
      seedStudio();
      await repos.members.insert(member("m-1", "Ada", "ada@example.com"));
      await repos.invoices.insert(invoice("i-1", "2026-0001", "2026-03-01T00:00:00.000Z", "m-1"));
      await repos.invoices.insert(invoice("i-2", "2026-0002", "2026-03-05T00:00:00.000Z", "m-1"));
    });

    it("lists invoices newest-issued first", async () => {
      expect((await repos.invoices.listByStudio(STUDIO.id)).map((row) => row.id)).toEqual([
        "i-2",
        "i-1",
      ]);
    });

    it("counts a studio's invoices", async () => {
      expect(await repos.invoices.countByStudio(STUDIO.id)).toBe(2);
      expect(await repos.invoices.countByStudio("other-studio")).toBe(0);
    });

    it("reads one invoice and marks it paid", async () => {
      expect(await repos.invoices.getById("i-1")).toEqual(
        invoice("i-1", "2026-0001", "2026-03-01T00:00:00.000Z", "m-1"),
      );
      expect(await repos.invoices.getById("nope")).toBeNull();
      const paid = await repos.invoices.update("i-1", {
        status: "paid",
        paidAt: "2026-03-02T00:00:00.000Z",
      });
      expect(paid).toMatchObject({ status: "paid", paidAt: "2026-03-02T00:00:00.000Z" });
    });

    it("inserts line items in bulk and reads them back per invoice", async () => {
      expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
      const items = [lineItem("li-1", "i-1", null), lineItem("li-2", "i-1", null)];
      expect(await repos.invoiceLineItems.insertMany(items)).toEqual(items);
      expect(await repos.invoiceLineItems.listByInvoice("i-1")).toEqual(items);
      expect(await repos.invoiceLineItems.listByInvoice("i-2")).toEqual([]);
    });
  });

  describe("notification outbox", () => {
    beforeEach(async () => {
      seedStudio();
      await repos.members.insert(member("m-1", "Ada", "ada@example.com"));
    });

    it("lists only rows that have not been sent", async () => {
      await repos.outbox.insert(outboxRow("o-1", "m-1", null));
      await repos.outbox.insert(outboxRow("o-2", "m-1", "2026-01-03T09:05:00.000Z"));
      expect(await repos.outbox.listPending()).toEqual([outboxRow("o-1", "m-1", null)]);
    });

    it("records a delivery result", async () => {
      await repos.outbox.insert(outboxRow("o-1", "m-1", null));
      const sent = await repos.outbox.update("o-1", {
        sentAt: "2026-01-03T09:05:00.000Z",
        providerMessageId: "msg_1",
      });
      expect(sent).toEqual({
        ...outboxRow("o-1", "m-1", "2026-01-03T09:05:00.000Z"),
        providerMessageId: "msg_1",
      });
      expect(await repos.outbox.listPending()).toEqual([]);
    });
  });
});
