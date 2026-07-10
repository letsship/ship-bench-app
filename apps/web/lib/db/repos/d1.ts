import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
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
import type { Repositories } from "./types";

// The production repository implementation over drizzle-orm/d1 (the Cloudflare
// D1 binding). Drizzle maps camelCase JS fields to/from the snake_case columns
// declared in ../schema.ts, so query results already match the domain types in
// ../types — no manual row-mapping layer, unlike the Supabase impl it replaces.
// This is the ONE file a persistence-adapter migration rewrites — nothing above
// the repository interface changes.

function db() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB);
}

export function createD1Repositories(): Repositories {
  return {
    studios: {
      getFirst: async (): Promise<Studio | null> =>
        (await db().select().from(studios).limit(1))[0] ?? null,
    },
    settings: {
      getByStudioId: async (studioId): Promise<StudioSettings | null> =>
        (
          await db().select().from(studioSettings).where(eq(studioSettings.studioId, studioId))
        )[0] ?? null,
      update: async (studioId, patch): Promise<StudioSettings> => {
        const rows = await db()
          .update(studioSettings)
          .set(patch)
          .where(eq(studioSettings.studioId, studioId))
          .returning();
        return rows[0] as StudioSettings;
      },
    },
    members: {
      listByStudio: async (studioId): Promise<Member[]> =>
        db()
          .select()
          .from(members)
          .where(eq(members.studioId, studioId))
          .orderBy(asc(members.name)),
      getById: async (id): Promise<Member | null> =>
        (await db().select().from(members).where(eq(members.id, id)))[0] ?? null,
      findByEmail: async (studioId, email): Promise<Member | null> =>
        (
          await db()
            .select()
            .from(members)
            .where(and(eq(members.studioId, studioId), eq(members.email, email)))
        )[0] ?? null,
      insert: async (member: Member): Promise<Member> =>
        (await db().insert(members).values(member).returning())[0] as Member,
      update: async (id, patch): Promise<Member> => {
        const rows = await db().update(members).set(patch).where(eq(members.id, id)).returning();
        return rows[0] as Member;
      },
    },
    classTypes: {
      listByStudio: async (studioId): Promise<ClassType[]> =>
        db()
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name)),
      getById: async (id): Promise<ClassType | null> =>
        (await db().select().from(classTypes).where(eq(classTypes.id, id)))[0] ?? null,
      insert: async (classType: ClassType): Promise<ClassType> =>
        (await db().insert(classTypes).values(classType).returning())[0] as ClassType,
    },
    classSessions: {
      listByStudio: async (studioId, range = {}): Promise<ClassSession[]> => {
        const conditions = [eq(classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(classSessions.startsAt, range.to));
        return db()
          .select()
          .from(classSessions)
          .where(and(...conditions))
          .orderBy(asc(classSessions.startsAt));
      },
      getById: async (id): Promise<ClassSession | null> =>
        (await db().select().from(classSessions).where(eq(classSessions.id, id)))[0] ?? null,
      insert: async (session: ClassSession): Promise<ClassSession> =>
        (await db().insert(classSessions).values(session).returning())[0] as ClassSession,
    },
    bookings: {
      listBySessionIds: async (sessionIds): Promise<Booking[]> => {
        if (sessionIds.length === 0) return [];
        return db().select().from(bookings).where(inArray(bookings.sessionId, sessionIds));
      },
      listBySession: async (sessionId): Promise<Booking[]> =>
        db().select().from(bookings).where(eq(bookings.sessionId, sessionId)),
      getById: async (id): Promise<Booking | null> =>
        (await db().select().from(bookings).where(eq(bookings.id, id)))[0] ?? null,
      insert: async (booking: Booking): Promise<Booking> =>
        (await db().insert(bookings).values(booking).returning())[0] as Booking,
      update: async (id, patch): Promise<Booking> => {
        const rows = await db().update(bookings).set(patch).where(eq(bookings.id, id)).returning();
        return rows[0] as Booking;
      },
    },
    invoices: {
      listByStudio: async (studioId): Promise<Invoice[]> =>
        db()
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt)),
      getById: async (id): Promise<Invoice | null> =>
        (await db().select().from(invoices).where(eq(invoices.id, id)))[0] ?? null,
      countByStudio: async (studioId): Promise<number> => {
        const rows = await db()
          .select({ count: sql<number>`count(*)` })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return rows[0]?.count ?? 0;
      },
      insert: async (invoice: Invoice): Promise<Invoice> =>
        (await db().insert(invoices).values(invoice).returning())[0] as Invoice,
      update: async (id, patch): Promise<Invoice> => {
        const rows = await db().update(invoices).set(patch).where(eq(invoices.id, id)).returning();
        return rows[0] as Invoice;
      },
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId): Promise<InvoiceLineItem[]> =>
        db().select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId)),
      insertMany: async (items: InvoiceLineItem[]): Promise<InvoiceLineItem[]> => {
        if (items.length === 0) return [];
        return db().insert(invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      insert: async (row: NotificationOutboxRow): Promise<NotificationOutboxRow> =>
        (await db().insert(notificationOutbox).values(row).returning())[0] as NotificationOutboxRow,
      listPending: async (): Promise<NotificationOutboxRow[]> =>
        db().select().from(notificationOutbox).where(isNull(notificationOutbox.sentAt)),
      update: async (id, patch): Promise<NotificationOutboxRow> => {
        const rows = await db()
          .update(notificationOutbox)
          .set(patch)
          .where(eq(notificationOutbox.id, id))
          .returning();
        return rows[0] as NotificationOutboxRow;
      },
    },
  };
}
