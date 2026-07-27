import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
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
import type { Repositories } from "./types";

// The production repository implementation: Drizzle ORM over the Cloudflare D1
// binding. This is the ONE file a D1→other-database migration rewrites —
// nothing above the repository interface changes. Services build full rows
// app-side (ids + timestamps set by the caller), so this is a straight
// write-through: insert/update simply persist the given row and read the
// current row back via `.returning()`.

function fail(context: string): never {
  throw new Error(`D1 ${context} failed: no row returned`);
}

export function createD1Repositories(db: D1Database): Repositories {
  const orm = drizzle(db, {
    schema: {
      studios,
      studioSettings,
      members,
      classTypes,
      classSessions,
      bookings,
      invoices,
      invoiceLineItems,
      notificationOutbox,
    },
  });

  return {
    studios: {
      async getFirst() {
        const rows = await orm.select().from(studios).limit(1);
        return (rows[0] as Studio | undefined) ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const rows = await orm
          .select()
          .from(studioSettings)
          .where(eq(studioSettings.studioId, studioId))
          .limit(1);
        return (rows[0] as StudioSettings | undefined) ?? null;
      },
      async update(studioId, patch) {
        const rows = await orm
          .update(studioSettings)
          .set(patch)
          .where(eq(studioSettings.studioId, studioId))
          .returning();
        return (rows[0] as StudioSettings | undefined) ?? fail("settings.update");
      },
    },
    members: {
      async listByStudio(studioId) {
        return orm
          .select()
          .from(members)
          .where(eq(members.studioId, studioId))
          .orderBy(asc(members.name)) as Promise<Member[]>;
      },
      async getById(id) {
        const rows = await orm.select().from(members).where(eq(members.id, id)).limit(1);
        return (rows[0] as Member | undefined) ?? null;
      },
      async findByEmail(studioId, email) {
        const rows = await orm
          .select()
          .from(members)
          .where(and(eq(members.studioId, studioId), eq(members.email, email)))
          .limit(1);
        return (rows[0] as Member | undefined) ?? null;
      },
      async insert(member) {
        const rows = await orm.insert(members).values(member).returning();
        return (rows[0] as Member | undefined) ?? fail("members.insert");
      },
      async update(id, patch) {
        const rows = await orm.update(members).set(patch).where(eq(members.id, id)).returning();
        return (rows[0] as Member | undefined) ?? fail("members.update");
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return orm
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name)) as Promise<ClassType[]>;
      },
      async getById(id) {
        const rows = await orm.select().from(classTypes).where(eq(classTypes.id, id)).limit(1);
        return (rows[0] as ClassType | undefined) ?? null;
      },
      async insert(classType) {
        const rows = await orm.insert(classTypes).values(classType).returning();
        return (rows[0] as ClassType | undefined) ?? fail("classTypes.insert");
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(classSessions.startsAt, range.to));
        return orm
          .select()
          .from(classSessions)
          .where(and(...conditions))
          .orderBy(asc(classSessions.startsAt)) as Promise<ClassSession[]>;
      },
      async getById(id) {
        const rows = await orm
          .select()
          .from(classSessions)
          .where(eq(classSessions.id, id))
          .limit(1);
        return (rows[0] as ClassSession | undefined) ?? null;
      },
      async insert(session) {
        const rows = await orm.insert(classSessions).values(session).returning();
        return (rows[0] as ClassSession | undefined) ?? fail("classSessions.insert");
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return orm
          .select()
          .from(bookings)
          .where(inArray(bookings.sessionId, sessionIds)) as Promise<Booking[]>;
      },
      async listBySession(sessionId) {
        return orm.select().from(bookings).where(eq(bookings.sessionId, sessionId)) as Promise<
          Booking[]
        >;
      },
      async getById(id) {
        const rows = await orm.select().from(bookings).where(eq(bookings.id, id)).limit(1);
        return (rows[0] as Booking | undefined) ?? null;
      },
      async insert(booking) {
        const rows = await orm.insert(bookings).values(booking).returning();
        return (rows[0] as Booking | undefined) ?? fail("bookings.insert");
      },
      async update(id, patch) {
        const rows = await orm.update(bookings).set(patch).where(eq(bookings.id, id)).returning();
        return (rows[0] as Booking | undefined) ?? fail("bookings.update");
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return orm
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt)) as Promise<Invoice[]>;
      },
      async getById(id) {
        const rows = await orm.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        return (rows[0] as Invoice | undefined) ?? null;
      },
      async countByStudio(studioId) {
        const rows = await orm
          .select({ value: count() })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return rows[0]?.value ?? 0;
      },
      async insert(invoice) {
        const rows = await orm.insert(invoices).values(invoice).returning();
        return (rows[0] as Invoice | undefined) ?? fail("invoices.insert");
      },
      async update(id, patch) {
        const rows = await orm.update(invoices).set(patch).where(eq(invoices.id, id)).returning();
        return (rows[0] as Invoice | undefined) ?? fail("invoices.update");
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return orm
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoiceId)) as Promise<InvoiceLineItem[]>;
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        return orm.insert(invoiceLineItems).values(items).returning() as Promise<InvoiceLineItem[]>;
      },
    },
    outbox: {
      async insert(row) {
        const rows = await orm.insert(notificationOutbox).values(row).returning();
        return (rows[0] as NotificationOutboxRow | undefined) ?? fail("outbox.insert");
      },
      async listPending() {
        return orm
          .select()
          .from(notificationOutbox)
          .where(isNull(notificationOutbox.sentAt)) as Promise<NotificationOutboxRow[]>;
      },
      async update(id, patch) {
        const rows = await orm
          .update(notificationOutbox)
          .set(patch)
          .where(eq(notificationOutbox.id, id))
          .returning();
        return (rows[0] as NotificationOutboxRow | undefined) ?? fail("outbox.update");
      },
    },
  };
}
