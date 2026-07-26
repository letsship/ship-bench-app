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
import * as schema from "./schema";
import type { Repositories } from "./types";

// The production repository implementation over Drizzle ORM + the Cloudflare
// D1 binding. Column names map directly to the camelCase entity fields via
// `schema.ts`, so rows come back already shaped as domain entities — no
// snake/camel mapping layer is needed here. This is the ONE file a Supabase→D1
// migration rewrites; nothing above the repository interface changes.

function first<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) throw new Error(`${label} not found`);
  return row;
}

export function createD1Repositories(d1: D1Database): Repositories {
  const db = drizzle(d1, { schema });

  return {
    studios: {
      async getFirst() {
        const rows = await db.select().from(schema.studios).limit(1);
        return (rows[0] as Studio | undefined) ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const rows = await db
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return (rows[0] as StudioSettings | undefined) ?? null;
      },
      async update(studioId, patch) {
        const rows = await db
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return first(rows as StudioSettings[], "Studio settings");
      },
    },
    members: {
      async listByStudio(studioId) {
        return db
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name)) as Promise<Member[]>;
      },
      async getById(id) {
        const rows = await db.select().from(schema.members).where(eq(schema.members.id, id));
        return (rows[0] as Member | undefined) ?? null;
      },
      async findByEmail(studioId, email) {
        const rows = await db
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return (rows[0] as Member | undefined) ?? null;
      },
      async insert(member) {
        const rows = await db.insert(schema.members).values(member).returning();
        return first(rows as Member[], "Member");
      },
      async update(id, patch) {
        const rows = await db
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        return first(rows as Member[], "Member");
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name)) as Promise<ClassType[]>;
      },
      async getById(id) {
        const rows = await db.select().from(schema.classTypes).where(eq(schema.classTypes.id, id));
        return (rows[0] as ClassType | undefined) ?? null;
      },
      async insert(classType) {
        const rows = await db.insert(schema.classTypes).values(classType).returning();
        return first(rows as ClassType[], "Class type");
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return db
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt)) as Promise<ClassSession[]>;
      },
      async getById(id) {
        const rows = await db
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return (rows[0] as ClassSession | undefined) ?? null;
      },
      async insert(session) {
        const rows = await db.insert(schema.classSessions).values(session).returning();
        return first(rows as ClassSession[], "Class session");
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return db
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds)) as Promise<Booking[]>;
      },
      async listBySession(sessionId) {
        return db
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId)) as Promise<Booking[]>;
      },
      async getById(id) {
        const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return (rows[0] as Booking | undefined) ?? null;
      },
      async insert(booking) {
        const rows = await db.insert(schema.bookings).values(booking).returning();
        return first(rows as Booking[], "Booking");
      },
      async update(id, patch) {
        const rows = await db
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        return first(rows as Booking[], "Booking");
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt)) as Promise<Invoice[]>;
      },
      async getById(id) {
        const rows = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
        return (rows[0] as Invoice | undefined) ?? null;
      },
      async countByStudio(studioId) {
        const rows = await db
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows[0]?.value ?? 0;
      },
      async insert(invoice) {
        const rows = await db.insert(schema.invoices).values(invoice).returning();
        return first(rows as Invoice[], "Invoice");
      },
      async update(id, patch) {
        const rows = await db
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        return first(rows as Invoice[], "Invoice");
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return db
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId)) as Promise<InvoiceLineItem[]>;
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        return db.insert(schema.invoiceLineItems).values(items).returning() as Promise<
          InvoiceLineItem[]
        >;
      },
    },
    outbox: {
      async insert(row) {
        const rows = await db.insert(schema.notificationOutbox).values(row).returning();
        return first(rows as NotificationOutboxRow[], "Outbox row");
      },
      async listPending() {
        return db
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt)) as Promise<NotificationOutboxRow[]>;
      },
      async update(id, patch) {
        const rows = await db
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return first(rows as NotificationOutboxRow[], "Outbox row");
      },
    },
  };
}
