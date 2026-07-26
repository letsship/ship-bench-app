import { and, asc, count, desc, eq, gte, inArray, isNull, lt, type SQL } from "drizzle-orm";
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

// The production repository implementation over Drizzle ORM + Cloudflare D1.
// This is the ONE file a Supabase→D1 migration rewrites — nothing above the
// repository interface changes. Rows are already camelCase (see `schema.ts`),
// so no snake/camel mapping is needed on the query path.

type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createD1Repositories(db: D1Database): Repositories {
  const orm = drizzle(db, { schema });

  async function insertReturning<T extends object>(
    table: Parameters<Db["insert"]>[0],
    row: T,
  ): Promise<T> {
    const [inserted] = await orm.insert(table).values(row).returning();
    return inserted as T;
  }

  async function updateReturning<T extends object>(
    table: Parameters<Db["update"]>[0],
    where: SQL,
    patch: Partial<T>,
  ): Promise<T> {
    const [updated] = await orm.update(table).set(patch).where(where).returning();
    return updated as T;
  }

  return {
    studios: {
      async getFirst() {
        const [row] = await orm.select().from(schema.studios).limit(1);
        return (row as Studio | undefined) ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const [row] = await orm
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return (row as StudioSettings | undefined) ?? null;
      },
      update: (studioId, patch) =>
        updateReturning<StudioSettings>(
          schema.studioSettings,
          eq(schema.studioSettings.studioId, studioId),
          patch,
        ),
    },
    members: {
      async listByStudio(studioId) {
        const rows = await orm
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
        return rows as Member[];
      },
      async getById(id) {
        const [row] = await orm.select().from(schema.members).where(eq(schema.members.id, id));
        return (row as Member | undefined) ?? null;
      },
      async findByEmail(studioId, email) {
        const [row] = await orm
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return (row as Member | undefined) ?? null;
      },
      insert: (member) => insertReturning<Member>(schema.members, member),
      update: (id, patch) =>
        updateReturning<Member>(schema.members, eq(schema.members.id, id), patch),
    },
    classTypes: {
      async listByStudio(studioId) {
        const rows = await orm
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
        return rows as ClassType[];
      },
      async getById(id) {
        const [row] = await orm
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return (row as ClassType | undefined) ?? null;
      },
      insert: (classType) => insertReturning<ClassType>(schema.classTypes, classType),
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        const rows = await orm
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
        return rows as ClassSession[];
      },
      async getById(id) {
        const [row] = await orm
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return (row as ClassSession | undefined) ?? null;
      },
      insert: (session) => insertReturning<ClassSession>(schema.classSessions, session),
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        const rows = await orm
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
        return rows as Booking[];
      },
      async listBySession(sessionId) {
        const rows = await orm
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
        return rows as Booking[];
      },
      async getById(id) {
        const [row] = await orm.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return (row as Booking | undefined) ?? null;
      },
      insert: (booking) => insertReturning<Booking>(schema.bookings, booking),
      update: (id, patch) =>
        updateReturning<Booking>(schema.bookings, eq(schema.bookings.id, id), patch),
    },
    invoices: {
      async listByStudio(studioId) {
        const rows = await orm
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
        return rows as Invoice[];
      },
      async getById(id) {
        const [row] = await orm.select().from(schema.invoices).where(eq(schema.invoices.id, id));
        return (row as Invoice | undefined) ?? null;
      },
      async countByStudio(studioId) {
        const [row] = await orm
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return row?.value ?? 0;
      },
      insert: (invoice) => insertReturning<Invoice>(schema.invoices, invoice),
      update: (id, patch) =>
        updateReturning<Invoice>(schema.invoices, eq(schema.invoices.id, id), patch),
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        const rows = await orm
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
        return rows as InvoiceLineItem[];
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        const rows = await orm.insert(schema.invoiceLineItems).values(items).returning();
        return rows as InvoiceLineItem[];
      },
    },
    outbox: {
      insert: (row) => insertReturning<NotificationOutboxRow>(schema.notificationOutbox, row),
      async listPending() {
        const rows = await orm
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
        return rows as NotificationOutboxRow[];
      },
      update: (id, patch) =>
        updateReturning<NotificationOutboxRow>(
          schema.notificationOutbox,
          eq(schema.notificationOutbox.id, id),
          patch,
        ),
    },
  };
}
