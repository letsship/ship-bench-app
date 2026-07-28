import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../schema";
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
import type { Repositories, SessionRange } from "./types";

// The production repository implementation: Drizzle ORM over the Cloudflare D1
// binding. It implements the exact same `Repositories` surface (and observable
// behaviour) as the old Supabase impl — services, routes, and domain code only
// ever see the interfaces, so nothing above this seam changes. The factory
// takes the D1 database binding so the adapter can be constructed against any
// D1 instance (production, preview, or a test shim).

export function createD1Repositories(db: D1Database): Repositories {
  const client = drizzle(db, { schema });

  return {
    studios: {
      getFirst: async () => {
        const rows = await client.select().from(schema.studios).limit(1);
        return (rows[0] as Studio | undefined) ?? null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const rows = await client
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId))
          .limit(1);
        return (rows[0] as StudioSettings | undefined) ?? null;
      },
      update: async (studioId, patch) => {
        await client
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId));
        const updated = await client
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId))
          .limit(1);
        return updated[0] as StudioSettings;
      },
    },
    members: {
      listByStudio: async (studioId) =>
        (await client
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name)) as Member[],
      getById: async (id) => {
        const rows = await client
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))
          .limit(1);
        return (rows[0] as Member | undefined) ?? null;
      },
      findByEmail: async (studioId, email) => {
        const rows = await client
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
          .limit(1);
        return (rows[0] as Member | undefined) ?? null;
      },
      insert: async (member) => {
        await client.insert(schema.members).values(member);
        return member;
      },
      update: async (id, patch) => {
        await client.update(schema.members).set(patch).where(eq(schema.members.id, id));
        const rows = await client
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))
          .limit(1);
        return rows[0] as Member;
      },
    },
    classTypes: {
      listByStudio: async (studioId) =>
        (await client
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name)) as ClassType[],
      getById: async (id) => {
        const rows = await client
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id))
          .limit(1);
        return (rows[0] as ClassType | undefined) ?? null;
      },
      insert: async (classType) => {
        await client.insert(schema.classTypes).values(classType);
        return classType;
      },
    },
    classSessions: {
      listByStudio: async (studioId, range: SessionRange = {}) => {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return (await client
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.startsAt)) as ClassSession[];
      },
      getById: async (id) => {
        const rows = await client
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id))
          .limit(1);
        return (rows[0] as ClassSession | undefined) ?? null;
      },
      insert: async (session) => {
        await client.insert(schema.classSessions).values(session);
        return session;
      },
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return (await client
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds))) as Booking[];
      },
      listBySession: async (sessionId) =>
        (await client
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId))) as Booking[],
      getById: async (id) => {
        const rows = await client
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id))
          .limit(1);
        return (rows[0] as Booking | undefined) ?? null;
      },
      insert: async (booking) => {
        await client.insert(schema.bookings).values(booking);
        return booking;
      },
      update: async (id, patch) => {
        await client.update(schema.bookings).set(patch).where(eq(schema.bookings.id, id));
        const rows = await client
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id))
          .limit(1);
        return rows[0] as Booking;
      },
    },
    invoices: {
      listByStudio: async (studioId) =>
        (await client
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt))) as Invoice[],
      getById: async (id) => {
        const rows = await client
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id))
          .limit(1);
        return (rows[0] as Invoice | undefined) ?? null;
      },
      countByStudio: async (studioId) => {
        const rows = await client
          .select({ count: sql<number>`count(*)` })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows[0]?.count ?? 0;
      },
      insert: async (invoice) => {
        await client.insert(schema.invoices).values(invoice);
        return invoice;
      },
      update: async (id, patch) => {
        await client.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id));
        const rows = await client
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id))
          .limit(1);
        return rows[0] as Invoice;
      },
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) =>
        (await client
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId))) as InvoiceLineItem[],
      insertMany: async (items) => {
        if (items.length === 0) return [];
        await client.insert(schema.invoiceLineItems).values(items);
        return items;
      },
    },
    outbox: {
      insert: async (row) => {
        await client.insert(schema.notificationOutbox).values(row);
        return row;
      },
      listPending: async () =>
        (await client
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt))) as NotificationOutboxRow[],
      update: async (id, patch) => {
        await client
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id));
        const rows = await client
          .select()
          .from(schema.notificationOutbox)
          .where(eq(schema.notificationOutbox.id, id))
          .limit(1);
        return rows[0] as NotificationOutboxRow;
      },
    },
  };
}
