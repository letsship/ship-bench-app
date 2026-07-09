import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
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

// The production repository implementation over drizzle-orm/d1, running
// against the Worker's `DB` D1 binding (see wrangler.jsonc). Column names in
// schema.ts are declared with the same JS property names as the entity types
// in ../types, so rows come back already camelCased — no manual mapping.
// This is the ONE file a D1→other-database migration rewrites — nothing above
// the repository interface changes.

type Database = DrizzleD1Database<typeof schema>;

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = getCloudflareContext({ async: true }).then(({ env }) =>
      drizzle(env.DB, { schema }),
    );
  }
  return dbPromise;
}

export function createD1Repositories(): Repositories {
  return {
    studios: {
      async getFirst(): Promise<Studio | null> {
        const db = await getDb();
        const rows = await db.select().from(schema.studios).limit(1);
        return rows[0] ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId): Promise<StudioSettings | null> {
        const db = await getDb();
        const rows = await db
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId))
          .limit(1);
        return rows[0] ?? null;
      },
      async update(studioId, patch): Promise<StudioSettings> {
        const db = await getDb();
        const rows = await db
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return rows[0];
      },
    },
    members: {
      async listByStudio(studioId): Promise<Member[]> {
        const db = await getDb();
        return db
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
      },
      async getById(id): Promise<Member | null> {
        const db = await getDb();
        const rows = await db
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async findByEmail(studioId, email): Promise<Member | null> {
        const db = await getDb();
        const rows = await db
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(member): Promise<Member> {
        const db = await getDb();
        const rows = await db.insert(schema.members).values(member).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Member> {
        const db = await getDb();
        const rows = await db
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        return rows[0];
      },
    },
    classTypes: {
      async listByStudio(studioId): Promise<ClassType[]> {
        const db = await getDb();
        return db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
      },
      async getById(id): Promise<ClassType | null> {
        const db = await getDb();
        const rows = await db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(classType): Promise<ClassType> {
        const db = await getDb();
        const rows = await db.insert(schema.classTypes).values(classType).returning();
        return rows[0];
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}): Promise<ClassSession[]> {
        const db = await getDb();
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return db
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
      },
      async getById(id): Promise<ClassSession | null> {
        const db = await getDb();
        const rows = await db
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(session): Promise<ClassSession> {
        const db = await getDb();
        const rows = await db.insert(schema.classSessions).values(session).returning();
        return rows[0];
      },
    },
    bookings: {
      async listBySessionIds(sessionIds): Promise<Booking[]> {
        if (sessionIds.length === 0) return [];
        const db = await getDb();
        return db
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId): Promise<Booking[]> {
        const db = await getDb();
        return db.select().from(schema.bookings).where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id): Promise<Booking | null> {
        const db = await getDb();
        const rows = await db
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(booking): Promise<Booking> {
        const db = await getDb();
        const rows = await db.insert(schema.bookings).values(booking).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Booking> {
        const db = await getDb();
        const rows = await db
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        return rows[0];
      },
    },
    invoices: {
      async listByStudio(studioId): Promise<Invoice[]> {
        const db = await getDb();
        return db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      async getById(id): Promise<Invoice | null> {
        const db = await getDb();
        const rows = await db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async countByStudio(studioId): Promise<number> {
        const db = await getDb();
        const rows = await db
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows[0]?.value ?? 0;
      },
      async insert(invoice): Promise<Invoice> {
        const db = await getDb();
        const rows = await db.insert(schema.invoices).values(invoice).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Invoice> {
        const db = await getDb();
        const rows = await db
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        return rows[0];
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId): Promise<InvoiceLineItem[]> {
        const db = await getDb();
        return db
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items): Promise<InvoiceLineItem[]> {
        if (items.length === 0) return [];
        const db = await getDb();
        return db.insert(schema.invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      async insert(row): Promise<NotificationOutboxRow> {
        const db = await getDb();
        const rows = await db.insert(schema.notificationOutbox).values(row).returning();
        return rows[0];
      },
      async listPending(): Promise<NotificationOutboxRow[]> {
        const db = await getDb();
        return db
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch): Promise<NotificationOutboxRow> {
        const db = await getDb();
        const rows = await db
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return rows[0];
      },
    },
  };
}
