import type { D1Database } from "@cloudflare/workers-types";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  Member,
  NotificationOutboxRow,
  Studio,
  StudioSettings,
} from "../types";
import * as schema from "./schema";
import type { Repositories, SessionRange } from "./types";

// The production repository implementation: Drizzle ORM over the Worker's D1
// binding. The schema module maps the snake_case columns to the camelCase
// entity fields, so rows come back as plain entities. This is the ONE file a
// D1→other-database migration rewrites — nothing above the repository
// interface changes.

function firstOrNull<T>(rows: T[]): T | null {
  return rows[0] ?? null;
}

function mustRow<T>(rows: T[], context: string): T {
  const row = rows[0];
  if (!row) throw new Error(`D1 ${context} matched no row`);
  return row;
}

export function createD1Repositories(d1: D1Database): Repositories {
  const db = drizzle(d1, { schema });

  function sessionFilters(studioId: string, range: SessionRange) {
    const filters = [eq(schema.classSessions.studioId, studioId)];
    if (range.from) filters.push(gte(schema.classSessions.startsAt, range.from));
    if (range.to) filters.push(lt(schema.classSessions.startsAt, range.to));
    return and(...filters);
  }

  return {
    studios: {
      getFirst: async () => firstOrNull<Studio>(await db.select().from(schema.studios).limit(1)),
    },
    settings: {
      getByStudioId: async (studioId) =>
        firstOrNull<StudioSettings>(
          await db
            .select()
            .from(schema.studioSettings)
            .where(eq(schema.studioSettings.studioId, studioId)),
        ),
      update: async (studioId, patch) =>
        mustRow<StudioSettings>(
          await db
            .update(schema.studioSettings)
            .set(patch)
            .where(eq(schema.studioSettings.studioId, studioId))
            .returning(),
          "update studio_settings",
        ),
    },
    members: {
      listByStudio: (studioId) =>
        db
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name)),
      getById: async (id) =>
        firstOrNull<Member>(
          await db.select().from(schema.members).where(eq(schema.members.id, id)),
        ),
      findByEmail: async (studioId, email) =>
        firstOrNull<Member>(
          await db
            .select()
            .from(schema.members)
            .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email))),
        ),
      insert: async (member) =>
        mustRow<Member>(
          await db.insert(schema.members).values(member).returning(),
          "insert into members",
        ),
      update: async (id, patch) =>
        mustRow<Member>(
          await db.update(schema.members).set(patch).where(eq(schema.members.id, id)).returning(),
          "update members",
        ),
    },
    classTypes: {
      listByStudio: (studioId) =>
        db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name)),
      getById: async (id) =>
        firstOrNull<ClassType>(
          await db.select().from(schema.classTypes).where(eq(schema.classTypes.id, id)),
        ),
      insert: async (classType) =>
        mustRow<ClassType>(
          await db.insert(schema.classTypes).values(classType).returning(),
          "insert into class_types",
        ),
    },
    classSessions: {
      listByStudio: (studioId, range = {}) =>
        db
          .select()
          .from(schema.classSessions)
          .where(sessionFilters(studioId, range))
          .orderBy(asc(schema.classSessions.startsAt)),
      getById: async (id) =>
        firstOrNull<ClassSession>(
          await db.select().from(schema.classSessions).where(eq(schema.classSessions.id, id)),
        ),
      insert: async (session) =>
        mustRow<ClassSession>(
          await db.insert(schema.classSessions).values(session).returning(),
          "insert into class_sessions",
        ),
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return db
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      listBySession: (sessionId) =>
        db.select().from(schema.bookings).where(eq(schema.bookings.sessionId, sessionId)),
      getById: async (id) =>
        firstOrNull<Booking>(
          await db.select().from(schema.bookings).where(eq(schema.bookings.id, id)),
        ),
      insert: async (booking) =>
        mustRow<Booking>(
          await db.insert(schema.bookings).values(booking).returning(),
          "insert into bookings",
        ),
      update: async (id, patch) =>
        mustRow<Booking>(
          await db.update(schema.bookings).set(patch).where(eq(schema.bookings.id, id)).returning(),
          "update bookings",
        ),
    },
    invoices: {
      listByStudio: (studioId) =>
        db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt)),
      getById: async (id) =>
        firstOrNull<Invoice>(
          await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)),
        ),
      countByStudio: async (studioId) => {
        const [row] = await db
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return row?.value ?? 0;
      },
      insert: async (invoice) =>
        mustRow<Invoice>(
          await db.insert(schema.invoices).values(invoice).returning(),
          "insert into invoices",
        ),
      update: async (id, patch) =>
        mustRow<Invoice>(
          await db.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id)).returning(),
          "update invoices",
        ),
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        db
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId)),
      insertMany: async (items) => {
        if (items.length === 0) return [];
        return db.insert(schema.invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      insert: async (row) =>
        mustRow<NotificationOutboxRow>(
          await db.insert(schema.notificationOutbox).values(row).returning(),
          "insert into notification_outbox",
        ),
      listPending: () =>
        db.select().from(schema.notificationOutbox).where(isNull(schema.notificationOutbox.sentAt)),
      update: async (id, patch) =>
        mustRow<NotificationOutboxRow>(
          await db
            .update(schema.notificationOutbox)
            .set(patch)
            .where(eq(schema.notificationOutbox.id, id))
            .returning(),
          "update notification_outbox",
        ),
    },
  };
}
