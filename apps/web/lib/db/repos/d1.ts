import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
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
// Table shapes in `./schema` map camelCase columns directly onto the entity
// types in `../types`, so rows read back from Drizzle are already the right
// shape — no separate camel/snake mapping step is needed here (that transform
// is used only by the seed-SQL emitter). This is the ONE file a D1→other-store
// migration rewrites — nothing above the repository interface changes.

export function createD1Repositories(db: D1Database): Repositories {
  const orm = drizzle(db, { schema });

  async function getOne<T>(query: Promise<T[]>): Promise<T | null> {
    const [row] = await query;
    return row ?? null;
  }

  return {
    studios: {
      async getFirst(): Promise<Studio | null> {
        return getOne(orm.select().from(schema.studios).limit(1));
      },
    },
    settings: {
      async getByStudioId(studioId): Promise<StudioSettings | null> {
        return getOne(
          orm
            .select()
            .from(schema.studioSettings)
            .where(eq(schema.studioSettings.studioId, studioId)),
        );
      },
      async update(studioId, patch): Promise<StudioSettings> {
        await orm
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId));
        const row = await getOne(
          orm
            .select()
            .from(schema.studioSettings)
            .where(eq(schema.studioSettings.studioId, studioId)),
        );
        if (!row) throw new Error("Studio settings not found");
        return row;
      },
    },
    members: {
      async listByStudio(studioId): Promise<Member[]> {
        return orm
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
      },
      async getById(id): Promise<Member | null> {
        return getOne(orm.select().from(schema.members).where(eq(schema.members.id, id)));
      },
      async findByEmail(studioId, email): Promise<Member | null> {
        return getOne(
          orm
            .select()
            .from(schema.members)
            .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email))),
        );
      },
      async insert(member): Promise<Member> {
        await orm.insert(schema.members).values(member);
        return member;
      },
      async update(id, patch): Promise<Member> {
        await orm.update(schema.members).set(patch).where(eq(schema.members.id, id));
        const row = await getOne(
          orm.select().from(schema.members).where(eq(schema.members.id, id)),
        );
        if (!row) throw new Error("Member not found");
        return row;
      },
    },
    classTypes: {
      async listByStudio(studioId): Promise<ClassType[]> {
        return orm
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
      },
      async getById(id): Promise<ClassType | null> {
        return getOne(orm.select().from(schema.classTypes).where(eq(schema.classTypes.id, id)));
      },
      async insert(classType): Promise<ClassType> {
        await orm.insert(schema.classTypes).values(classType);
        return classType;
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}): Promise<ClassSession[]> {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return orm
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
      },
      async getById(id): Promise<ClassSession | null> {
        return getOne(
          orm.select().from(schema.classSessions).where(eq(schema.classSessions.id, id)),
        );
      },
      async insert(session): Promise<ClassSession> {
        await orm.insert(schema.classSessions).values(session);
        return session;
      },
    },
    bookings: {
      async listBySessionIds(sessionIds): Promise<Booking[]> {
        if (sessionIds.length === 0) return [];
        return orm
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId): Promise<Booking[]> {
        return orm.select().from(schema.bookings).where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id): Promise<Booking | null> {
        return getOne(orm.select().from(schema.bookings).where(eq(schema.bookings.id, id)));
      },
      async insert(booking): Promise<Booking> {
        await orm.insert(schema.bookings).values(booking);
        return booking;
      },
      async update(id, patch): Promise<Booking> {
        await orm.update(schema.bookings).set(patch).where(eq(schema.bookings.id, id));
        const row = await getOne(
          orm.select().from(schema.bookings).where(eq(schema.bookings.id, id)),
        );
        if (!row) throw new Error("Booking not found");
        return row;
      },
    },
    invoices: {
      async listByStudio(studioId): Promise<Invoice[]> {
        return orm
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      async getById(id): Promise<Invoice | null> {
        return getOne(orm.select().from(schema.invoices).where(eq(schema.invoices.id, id)));
      },
      async countByStudio(studioId): Promise<number> {
        const rows = await orm
          .select({ id: schema.invoices.id })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows.length;
      },
      async insert(invoice): Promise<Invoice> {
        await orm.insert(schema.invoices).values(invoice);
        return invoice;
      },
      async update(id, patch): Promise<Invoice> {
        await orm.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id));
        const row = await getOne(
          orm.select().from(schema.invoices).where(eq(schema.invoices.id, id)),
        );
        if (!row) throw new Error("Invoice not found");
        return row;
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId): Promise<InvoiceLineItem[]> {
        return orm
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items): Promise<InvoiceLineItem[]> {
        if (items.length === 0) return [];
        await orm.insert(schema.invoiceLineItems).values(items);
        return items;
      },
    },
    outbox: {
      async insert(row): Promise<NotificationOutboxRow> {
        await orm.insert(schema.notificationOutbox).values(row);
        return row;
      },
      async listPending(): Promise<NotificationOutboxRow[]> {
        return orm
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch): Promise<NotificationOutboxRow> {
        await orm
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id));
        const row = await getOne(
          orm.select().from(schema.notificationOutbox).where(eq(schema.notificationOutbox.id, id)),
        );
        if (!row) throw new Error("Outbox row not found");
        return row;
      },
    },
  };
}
