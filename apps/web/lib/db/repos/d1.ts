import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "../schema";
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

// The production repository implementation over Drizzle ORM + Cloudflare D1.
// The factory takes the Worker's D1 database binding so the adapter can be
// constructed against any D1 instance (production DB, preview DB, or a local
// one in tests). Drizzle maps the snake_case columns to the camelCase entity
// fields via lib/db/schema.ts — nothing above the repository interface changes.

export function createD1Repositories(db: D1Database): Repositories {
  const client = drizzle(db, { schema });

  const first = <T>(rows: T[]): T | null => rows[0] ?? null;

  return {
    studios: {
      getFirst: async (): Promise<Studio | null> =>
        first(await client.select().from(schema.studios).limit(1)),
    },
    settings: {
      getByStudioId: async (studioId): Promise<StudioSettings | null> =>
        first(
          await client
            .select()
            .from(schema.studioSettings)
            .where(eq(schema.studioSettings.studioId, studioId))
            .limit(1),
        ),
      update: async (studioId, patch): Promise<StudioSettings> =>
        first(
          await client
            .update(schema.studioSettings)
            .set(patch)
            .where(eq(schema.studioSettings.studioId, studioId))
            .returning(),
        ) as StudioSettings,
    },
    members: {
      listByStudio: (studioId): Promise<Member[]> =>
        client
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name),
      getById: async (id): Promise<Member | null> =>
        first(
          await client.select().from(schema.members).where(eq(schema.members.id, id)).limit(1),
        ),
      findByEmail: async (studioId, email): Promise<Member | null> =>
        first(
          await client
            .select()
            .from(schema.members)
            .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
            .limit(1),
        ),
      insert: async (member): Promise<Member> =>
        first(await client.insert(schema.members).values(member).returning()) as Member,
      update: async (id, patch): Promise<Member> =>
        first(
          await client
            .update(schema.members)
            .set(patch)
            .where(eq(schema.members.id, id))
            .returning(),
        ) as Member,
    },
    classTypes: {
      listByStudio: (studioId): Promise<ClassType[]> =>
        client
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name),
      getById: async (id): Promise<ClassType | null> =>
        first(
          await client
            .select()
            .from(schema.classTypes)
            .where(eq(schema.classTypes.id, id))
            .limit(1),
        ),
      insert: async (classType): Promise<ClassType> =>
        first(await client.insert(schema.classTypes).values(classType).returning()) as ClassType,
    },
    classSessions: {
      listByStudio: (studioId, range: SessionRange = {}): Promise<ClassSession[]> => {
        const filters = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) filters.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) filters.push(lt(schema.classSessions.startsAt, range.to));
        return client
          .select()
          .from(schema.classSessions)
          .where(and(...filters))
          .orderBy(schema.classSessions.startsAt);
      },
      getById: async (id): Promise<ClassSession | null> =>
        first(
          await client
            .select()
            .from(schema.classSessions)
            .where(eq(schema.classSessions.id, id))
            .limit(1),
        ),
      insert: async (session): Promise<ClassSession> =>
        first(
          await client.insert(schema.classSessions).values(session).returning(),
        ) as ClassSession,
    },
    bookings: {
      listBySessionIds: async (sessionIds): Promise<Booking[]> => {
        if (sessionIds.length === 0) return [];
        return client
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      listBySession: (sessionId): Promise<Booking[]> =>
        client.select().from(schema.bookings).where(eq(schema.bookings.sessionId, sessionId)),
      getById: async (id): Promise<Booking | null> =>
        first(
          await client.select().from(schema.bookings).where(eq(schema.bookings.id, id)).limit(1),
        ),
      insert: async (booking): Promise<Booking> =>
        first(await client.insert(schema.bookings).values(booking).returning()) as Booking,
      update: async (id, patch): Promise<Booking> =>
        first(
          await client
            .update(schema.bookings)
            .set(patch)
            .where(eq(schema.bookings.id, id))
            .returning(),
        ) as Booking,
    },
    invoices: {
      listByStudio: (studioId): Promise<Invoice[]> =>
        client
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt)),
      getById: async (id): Promise<Invoice | null> =>
        first(
          await client.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1),
        ),
      countByStudio: async (studioId): Promise<number> => {
        const rows = await client
          .select({ count: sql<number>`count(*)` })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows[0]?.count ?? 0;
      },
      insert: async (invoice): Promise<Invoice> =>
        first(await client.insert(schema.invoices).values(invoice).returning()) as Invoice,
      update: async (id, patch): Promise<Invoice> =>
        first(
          await client
            .update(schema.invoices)
            .set(patch)
            .where(eq(schema.invoices.id, id))
            .returning(),
        ) as Invoice,
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId): Promise<InvoiceLineItem[]> =>
        client
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId)),
      insertMany: async (items): Promise<InvoiceLineItem[]> => {
        if (items.length === 0) return [];
        return client.insert(schema.invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      insert: async (row): Promise<NotificationOutboxRow> =>
        first(
          await client.insert(schema.notificationOutbox).values(row).returning(),
        ) as NotificationOutboxRow,
      listPending: (): Promise<NotificationOutboxRow[]> =>
        client
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt)),
      update: async (id, patch): Promise<NotificationOutboxRow> =>
        first(
          await client
            .update(schema.notificationOutbox)
            .set(patch)
            .where(eq(schema.notificationOutbox.id, id))
            .returning(),
        ) as NotificationOutboxRow,
    },
  };
}
