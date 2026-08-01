import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "../schema";
import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  Member,
  Studio,
  StudioSettings,
} from "../types";
import type { Repositories } from "./types";

async function required<T>(rows: PromiseLike<T[]>, context: string): Promise<T> {
  const [row] = await rows;
  if (!row) throw new Error(`D1 ${context} returned no row`);
  return row;
}

async function maybeOne<T>(rows: PromiseLike<T[]>): Promise<T | null> {
  const [row] = await rows;
  return row ?? null;
}

export function createD1Repositories(database: D1Database): Repositories {
  const db = drizzle(database, { schema });

  return {
    studios: {
      getFirst: () => maybeOne<Studio>(db.select().from(schema.studios).limit(1)),
    },
    settings: {
      getByStudioId: (studioId) =>
        maybeOne<StudioSettings>(
          db.select().from(schema.studioSettings).where(eq(schema.studioSettings.studioId, studioId)),
        ),
      update: (studioId, patch) =>
        required(
          db
            .update(schema.studioSettings)
            .set(patch)
            .where(eq(schema.studioSettings.studioId, studioId))
            .returning(),
          "settings.update",
        ),
    },
    members: {
      listByStudio: (studioId) =>
        db
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name)),
      getById: (id) => maybeOne<Member>(db.select().from(schema.members).where(eq(schema.members.id, id))),
      findByEmail: (studioId, email) =>
        maybeOne<Member>(
          db
            .select()
            .from(schema.members)
            .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email))),
        ),
      insert: (member) => required(db.insert(schema.members).values(member).returning(), "members.insert"),
      update: (id, patch) =>
        required(
          db.update(schema.members).set(patch).where(eq(schema.members.id, id)).returning(),
          "members.update",
        ),
    },
    classTypes: {
      listByStudio: (studioId) =>
        db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name)),
      getById: (id) =>
        maybeOne<ClassType>(db.select().from(schema.classTypes).where(eq(schema.classTypes.id, id))),
      insert: (classType) =>
        required(db.insert(schema.classTypes).values(classType).returning(), "classTypes.insert"),
    },
    classSessions: {
      listByStudio: (studioId, range = {}) => {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return db
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
      },
      getById: (id) =>
        maybeOne<ClassSession>(
          db.select().from(schema.classSessions).where(eq(schema.classSessions.id, id)),
        ),
      insert: (session) =>
        required(db.insert(schema.classSessions).values(session).returning(), "classSessions.insert"),
    },
    bookings: {
      listBySessionIds: (sessionIds) =>
        sessionIds.length === 0
          ? Promise.resolve([])
          : db.select().from(schema.bookings).where(inArray(schema.bookings.sessionId, sessionIds)),
      listBySession: (sessionId) =>
        db.select().from(schema.bookings).where(eq(schema.bookings.sessionId, sessionId)),
      getById: (id) =>
        maybeOne<Booking>(db.select().from(schema.bookings).where(eq(schema.bookings.id, id))),
      insert: (booking) => required(db.insert(schema.bookings).values(booking).returning(), "bookings.insert"),
      update: (id, patch) =>
        required(
          db.update(schema.bookings).set(patch).where(eq(schema.bookings.id, id)).returning(),
          "bookings.update",
        ),
    },
    invoices: {
      listByStudio: (studioId) =>
        db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt)),
      getById: (id) => maybeOne<Invoice>(db.select().from(schema.invoices).where(eq(schema.invoices.id, id))),
      countByStudio: async (studioId) => {
        const [result] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return result?.count ?? 0;
      },
      insert: (invoice) => required(db.insert(schema.invoices).values(invoice).returning(), "invoices.insert"),
      update: (id, patch) =>
        required(
          db.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id)).returning(),
          "invoices.update",
        ),
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        db.select().from(schema.invoiceLineItems).where(eq(schema.invoiceLineItems.invoiceId, invoiceId)),
      insertMany: (items) =>
        items.length === 0
          ? Promise.resolve([])
          : db.insert(schema.invoiceLineItems).values(items).returning(),
    },
    outbox: {
      insert: (row) =>
        required(db.insert(schema.notificationOutbox).values(row).returning(), "outbox.insert"),
      listPending: () =>
        db.select().from(schema.notificationOutbox).where(isNull(schema.notificationOutbox.sentAt)),
      update: (id, patch) =>
        required(
          db
            .update(schema.notificationOutbox)
            .set(patch)
            .where(eq(schema.notificationOutbox.id, id))
            .returning(),
          "outbox.update",
        ),
    },
  };
}
