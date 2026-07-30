import { drizzle } from "drizzle-orm/d1";
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import {
  bookings,
  classSessions,
  classTypes,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  studios,
  studioSettings,
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
import type { Repositories, SessionRange } from "./types";

// The production repository implementation over Cloudflare D1 via Drizzle ORM.
// Takes the Worker's D1 database binding as its argument so it can be built
// against any D1 instance. Drizzle maps the snake_case SQLite columns (declared
// in lib/db/schema.ts) to the camelCase entity fields, and integer boolean
// columns round-trip as JS booleans, so returned rows are plain entity objects
// with no manual mapping. Behaviour mirrors the previous Supabase adapter.
export function createD1Repositories(db: D1Database): Repositories {
  const client = drizzle(db);

  async function maybeOne<T>(query: Promise<T[]>): Promise<T | null> {
    const [row] = await query;
    return row ?? null;
  }

  function rangeFilter(range: SessionRange | undefined) {
    const conditions = [];
    if (range?.from) conditions.push(gt(classSessions.startsAt, range.from));
    if (range?.to) conditions.push(lt(classSessions.startsAt, range.to));
    return conditions.length ? and(...conditions) : undefined;
  }

  return {
    studios: {
      getFirst: () => maybeOne<Studio>(client.select().from(studios).limit(1)),
    },
    settings: {
      getByStudioId: (studioId) =>
        maybeOne<StudioSettings>(
          client.select().from(studioSettings).where(eq(studioSettings.studioId, studioId)).limit(1),
        ),
      update: (studioId, patch) =>
        client
          .update(studioSettings)
          .set(patch)
          .where(eq(studioSettings.studioId, studioId))
          .returning()
          .then(([row]) => row as StudioSettings),
    },
    members: {
      listByStudio: (studioId) =>
        client
          .select()
          .from(members)
          .where(eq(members.studioId, studioId))
          .orderBy(asc(members.name)) as Promise<Member[]>,
      getById: (id) =>
        maybeOne<Member>(client.select().from(members).where(eq(members.id, id)).limit(1)),
      findByEmail: (studioId, email) =>
        maybeOne<Member>(
          client
            .select()
            .from(members)
            .where(and(eq(members.studioId, studioId), eq(members.email, email)))
            .limit(1),
        ),
      insert: (member) =>
        client.insert(members).values(member).returning().then(([row]) => row as Member),
      update: (id, patch) =>
        client
          .update(members)
          .set(patch)
          .where(eq(members.id, id))
          .returning()
          .then(([row]) => row as Member),
    },
    classTypes: {
      listByStudio: (studioId) =>
        client
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name)) as Promise<ClassType[]>,
      getById: (id) =>
        maybeOne<ClassType>(client.select().from(classTypes).where(eq(classTypes.id, id)).limit(1)),
      insert: (classType) =>
        client.insert(classTypes).values(classType).returning().then(([row]) => row as ClassType),
    },
    classSessions: {
      listByStudio: (studioId, range = {}) =>
        client
          .select()
          .from(classSessions)
          .where(and(eq(classSessions.studioId, studioId), rangeFilter(range)))
          .orderBy(asc(classSessions.startsAt)) as Promise<ClassSession[]>,
      getById: (id) =>
        maybeOne<ClassSession>(
          client.select().from(classSessions).where(eq(classSessions.id, id)).limit(1),
        ),
      insert: (session) =>
        client.insert(classSessions).values(session).returning().then(([row]) => row as ClassSession),
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return (await client
          .select()
          .from(bookings)
          .where(inArray(bookings.sessionId, sessionIds))) as Booking[];
      },
      listBySession: (sessionId) =>
        client.select().from(bookings).where(eq(bookings.sessionId, sessionId)) as Promise<Booking[]>,
      getById: (id) =>
        maybeOne<Booking>(client.select().from(bookings).where(eq(bookings.id, id)).limit(1)),
      insert: (booking) =>
        client.insert(bookings).values(booking).returning().then(([row]) => row as Booking),
      update: (id, patch) =>
        client
          .update(bookings)
          .set(patch)
          .where(eq(bookings.id, id))
          .returning()
          .then(([row]) => row as Booking),
    },
    invoices: {
      listByStudio: (studioId) =>
        client
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt)) as Promise<Invoice[]>,
      getById: (id) =>
        maybeOne<Invoice>(client.select().from(invoices).where(eq(invoices.id, id)).limit(1)),
      countByStudio: async (studioId) => {
        const [row] = await client
          .select({ count: sql<number>`count(*)` })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return row?.count ?? 0;
      },
      insert: (invoice) =>
        client.insert(invoices).values(invoice).returning().then(([row]) => row as Invoice),
      update: (id, patch) =>
        client
          .update(invoices)
          .set(patch)
          .where(eq(invoices.id, id))
          .returning()
          .then(([row]) => row as Invoice),
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        client
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoiceId)) as Promise<InvoiceLineItem[]>,
      insertMany: async (items) => {
        if (items.length === 0) return [];
        return (await client
          .insert(invoiceLineItems)
          .values(items)
          .returning()) as InvoiceLineItem[];
      },
    },
    outbox: {
      insert: (row) =>
        client
          .insert(notificationOutbox)
          .values(row)
          .returning()
          .then(([row]) => row as NotificationOutboxRow),
      listPending: () =>
        client
          .select()
          .from(notificationOutbox)
          .where(isNull(notificationOutbox.sentAt)) as Promise<NotificationOutboxRow[]>,
      update: (id, patch) =>
        client
          .update(notificationOutbox)
          .set(patch)
          .where(eq(notificationOutbox.id, id))
          .returning()
          .then(([row]) => row as NotificationOutboxRow),
    },
  };
}
