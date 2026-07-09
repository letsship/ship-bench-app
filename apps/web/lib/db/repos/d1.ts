import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
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
import type { Repositories } from "./types";

// The production repository implementation over Drizzle ORM + the Cloudflare
// D1 binding. The schema (lib/db/schema.ts) declares JS field names that match
// the entity types exactly, so query results need no camel/snake conversion.
// This is the ONE file a Drizzle→other-database migration rewrites — nothing
// above the repository interface changes.

function one<T>(rows: T[], context: string): T {
  const row = rows[0];
  if (!row) throw new Error(`D1 ${context} returned no row`);
  return row;
}

export function createD1Repositories(db: D1Database): Repositories {
  const database = drizzle(db, { schema });

  return {
    studios: {
      async getFirst() {
        const rows = await database.select().from(schema.studios).limit(1);
        return (rows[0] as Studio | undefined) ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const rows = await database
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId))
          .limit(1);
        return (rows[0] as StudioSettings | undefined) ?? null;
      },
      async update(studioId, patch) {
        const rows = await database
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return one<StudioSettings>(rows as StudioSettings[], "settings.update");
      },
    },
    members: {
      async listByStudio(studioId) {
        return database
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name)) as Promise<Member[]>;
      },
      async getById(id) {
        const rows = await database
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))
          .limit(1);
        return (rows[0] as Member | undefined) ?? null;
      },
      async findByEmail(studioId, email) {
        const rows = await database
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
          .limit(1);
        return (rows[0] as Member | undefined) ?? null;
      },
      async insert(member) {
        const rows = await database.insert(schema.members).values(member).returning();
        return one<Member>(rows as Member[], "members.insert");
      },
      async update(id, patch) {
        const rows = await database
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        return one<Member>(rows as Member[], "members.update");
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return database
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name)) as Promise<ClassType[]>;
      },
      async getById(id) {
        const rows = await database
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id))
          .limit(1);
        return (rows[0] as ClassType | undefined) ?? null;
      },
      async insert(classType) {
        const rows = await database.insert(schema.classTypes).values(classType).returning();
        return one<ClassType>(rows as ClassType[], "classTypes.insert");
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return database
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt)) as Promise<ClassSession[]>;
      },
      async getById(id) {
        const rows = await database
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id))
          .limit(1);
        return (rows[0] as ClassSession | undefined) ?? null;
      },
      async insert(session) {
        const rows = await database.insert(schema.classSessions).values(session).returning();
        return one<ClassSession>(rows as ClassSession[], "classSessions.insert");
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return database
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds)) as Promise<Booking[]>;
      },
      async listBySession(sessionId) {
        return database
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId)) as Promise<Booking[]>;
      },
      async getById(id) {
        const rows = await database
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id))
          .limit(1);
        return (rows[0] as Booking | undefined) ?? null;
      },
      async insert(booking) {
        const rows = await database.insert(schema.bookings).values(booking).returning();
        return one<Booking>(rows as Booking[], "bookings.insert");
      },
      async update(id, patch) {
        const rows = await database
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        return one<Booking>(rows as Booking[], "bookings.update");
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return database
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt)) as Promise<Invoice[]>;
      },
      async getById(id) {
        const rows = await database
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id))
          .limit(1);
        return (rows[0] as Invoice | undefined) ?? null;
      },
      async countByStudio(studioId) {
        const rows = await database
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows[0]?.value ?? 0;
      },
      async insert(invoice) {
        const rows = await database.insert(schema.invoices).values(invoice).returning();
        return one<Invoice>(rows as Invoice[], "invoices.insert");
      },
      async update(id, patch) {
        const rows = await database
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        return one<Invoice>(rows as Invoice[], "invoices.update");
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return database
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId)) as Promise<InvoiceLineItem[]>;
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        const rows = await database.insert(schema.invoiceLineItems).values(items).returning();
        return rows as InvoiceLineItem[];
      },
    },
    outbox: {
      async insert(row) {
        const rows = await database.insert(schema.notificationOutbox).values(row).returning();
        return one<NotificationOutboxRow>(rows as NotificationOutboxRow[], "outbox.insert");
      },
      async listPending() {
        return database
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt)) as Promise<NotificationOutboxRow[]>;
      },
      async update(id, patch) {
        const rows = await database
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return one<NotificationOutboxRow>(rows as NotificationOutboxRow[], "outbox.update");
      },
    },
  };
}
