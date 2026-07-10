import type { D1Database } from "@cloudflare/workers-types";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
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
import type { Repositories } from "./types";

// The production repository implementation over Drizzle ORM + the Cloudflare D1
// binding. This is the ONE file a Supabase→other-database migration rewrites —
// nothing above the repository interface changes. Ids and timestamps are set
// app-side (see `lib/db/ids.ts` and the services), matching the in-memory fakes.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

async function maybeOne<T>(query: PromiseLike<T[]>): Promise<T | null> {
  const rows = await query;
  return rows[0] ?? null;
}

async function oneOrThrow<T>(query: PromiseLike<T[]>, label: string): Promise<T> {
  const rows = await query;
  const row = rows[0];
  if (!row) throw new Error(`${label} not found`);
  return row;
}

export function createD1Repositories(db: D1Database): Repositories {
  const orm = drizzle(db);

  return {
    studios: {
      getFirst: () => maybeOne(orm.select().from(studios).limit(1)),
    },
    settings: {
      getByStudioId: (studioId) =>
        maybeOne(orm.select().from(studioSettings).where(eq(studioSettings.studioId, studioId))),
      update: (studioId, patch) =>
        oneOrThrow(
          orm
            .update(studioSettings)
            .set(patch)
            .where(eq(studioSettings.studioId, studioId))
            .returning(),
          "Studio settings",
        ),
    },
    members: {
      listByStudio: (studioId) =>
        orm.select().from(members).where(eq(members.studioId, studioId)).orderBy(asc(members.name)),
      getById: (id) => maybeOne(orm.select().from(members).where(eq(members.id, id))),
      findByEmail: (studioId, email) =>
        maybeOne(
          orm
            .select()
            .from(members)
            .where(and(eq(members.studioId, studioId), eq(members.email, email))),
        ),
      insert: (member) => oneOrThrow(orm.insert(members).values(member).returning(), "Member"),
      update: (id, patch) =>
        oneOrThrow(orm.update(members).set(patch).where(eq(members.id, id)).returning(), "Member"),
    },
    classTypes: {
      listByStudio: (studioId) =>
        orm
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name)),
      getById: (id) => maybeOne(orm.select().from(classTypes).where(eq(classTypes.id, id))),
      insert: (classType) =>
        oneOrThrow(orm.insert(classTypes).values(classType).returning(), "Class type"),
    },
    classSessions: {
      listByStudio: (studioId, range = {}) => {
        const conditions = [eq(classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(classSessions.startsAt, range.to));
        return orm
          .select()
          .from(classSessions)
          .where(and(...conditions))
          .orderBy(asc(classSessions.startsAt));
      },
      getById: (id) => maybeOne(orm.select().from(classSessions).where(eq(classSessions.id, id))),
      insert: (session) =>
        oneOrThrow(orm.insert(classSessions).values(session).returning(), "Class session"),
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return orm.select().from(bookings).where(inArray(bookings.sessionId, sessionIds));
      },
      listBySession: (sessionId) =>
        orm.select().from(bookings).where(eq(bookings.sessionId, sessionId)),
      getById: (id) => maybeOne(orm.select().from(bookings).where(eq(bookings.id, id))),
      insert: (booking) => oneOrThrow(orm.insert(bookings).values(booking).returning(), "Booking"),
      update: (id, patch) =>
        oneOrThrow(
          orm.update(bookings).set(patch).where(eq(bookings.id, id)).returning(),
          "Booking",
        ),
    },
    invoices: {
      listByStudio: (studioId) =>
        orm
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt)),
      getById: (id) => maybeOne(orm.select().from(invoices).where(eq(invoices.id, id))),
      countByStudio: async (studioId) => {
        const [row] = await orm
          .select({ value: count() })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return row?.value ?? 0;
      },
      insert: (invoice) => oneOrThrow(orm.insert(invoices).values(invoice).returning(), "Invoice"),
      update: (id, patch) =>
        oneOrThrow(
          orm.update(invoices).set(patch).where(eq(invoices.id, id)).returning(),
          "Invoice",
        ),
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        orm.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId)),
      insertMany: async (items) => {
        if (items.length === 0) return [];
        return orm.insert(invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      insert: (row) =>
        oneOrThrow(orm.insert(notificationOutbox).values(row).returning(), "Outbox row"),
      listPending: () =>
        orm.select().from(notificationOutbox).where(isNull(notificationOutbox.sentAt)),
      update: (id, patch) =>
        oneOrThrow(
          orm
            .update(notificationOutbox)
            .set(patch)
            .where(eq(notificationOutbox.id, id))
            .returning(),
          "Outbox row",
        ),
    },
  };
}
