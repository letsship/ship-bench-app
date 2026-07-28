import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import * as s from "./schema";
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

// Production repository implementation over Cloudflare D1 via Drizzle ORM.
// Maps every method of the Repositories seam to D1 queries with the same
// behaviour as the now-removed Supabase adapter — same ordering, same filter
// semantics (inclusive-from / exclusive-to for sessions), same insert/update
// returning patterns.
//
// D1 does NOT support RETURNING clauses, so update operations re-fetch the
// row after applying the patch. Since all rows are fully-formed app-side
// (ids + timestamps set by the caller), insert simply returns the input.

export function createD1Repositories(db: D1Database): Repositories {
  const d = drizzle(db, { schema: s });

  // --- helpers ---------------------------------------------------------------

  async function insertRow<T extends { id: string }>(table: any, row: T): Promise<T> {
    await d.insert(table).values(row as any);
    return row;
  }

  async function insertRows<T extends { id: string }>(table: any, rows: T[]): Promise<T[]> {
    if (rows.length === 0) return [];
    await d.insert(table).values(rows as any);
    return rows;
  }

  // Update then re-fetch (D1 has no RETURNING).
  async function updateById<T extends { id: string }>(
    table: any,
    id: string,
    patch: Partial<T>,
    fetchFn: (db: any, uid: string) => Promise<T | null>,
  ): Promise<T> {
    await d.update(table).set(patch as any).where(eq(table.id, id));
    const row = await fetchFn(d, id);
    if (!row) throw new Error(`Row with id ${id} not found after update`);
    return row;
  }

  async function updateByStudioId(
    studioId: string,
    patch: Partial<StudioSettings>,
  ): Promise<StudioSettings> {
    await d.update(s.studioSettings).set(patch as any).where(eq(s.studioSettings.studioId, studioId));
    const rows = await d
      .select()
      .from(s.studioSettings)
      .where(eq(s.studioSettings.studioId, studioId))
      .limit(1);
    if (!rows[0]) throw new Error(`Settings for studio ${studioId} not found after update`);
    return rows[0] as StudioSettings;
  }

  // --- repository methods ----------------------------------------------------

  return {
    studios: {
      async getFirst(): Promise<Studio | null> {
        const rows = await d.select().from(s.studios).limit(1);
        return (rows[0] as Studio) ?? null;
      },
    },

    settings: {
      async getByStudioId(studioId: string): Promise<StudioSettings | null> {
        const rows = await d
          .select()
          .from(s.studioSettings)
          .where(eq(s.studioSettings.studioId, studioId))
          .limit(1);
        return (rows[0] as StudioSettings) ?? null;
      },

      async update(
        studioId: string,
        patch: Partial<StudioSettings>,
      ): Promise<StudioSettings> {
        return updateByStudioId(studioId, patch);
      },
    },

    members: {
      async listByStudio(studioId: string): Promise<Member[]> {
        const rows = await d
          .select()
          .from(s.members)
          .where(eq(s.members.studioId, studioId))
          .orderBy(s.members.name);
        return rows as Member[];
      },

      async getById(id: string): Promise<Member | null> {
        const rows = await d
          .select()
          .from(s.members)
          .where(eq(s.members.id, id))
          .limit(1);
        return (rows[0] as Member) ?? null;
      },

      async findByEmail(studioId: string, email: string): Promise<Member | null> {
        const rows = await d
          .select()
          .from(s.members)
          .where(and(eq(s.members.studioId, studioId), eq(s.members.email, email)))
          .limit(1);
        return (rows[0] as Member) ?? null;
      },

      async insert(member: Member): Promise<Member> {
        return insertRow<Member>(s.members, member);
      },

      async update(id: string, patch: Partial<Member>): Promise<Member> {
        return updateById<Member>(s.members, id, patch, async (_d, uid) => {
          const rows = await d.select().from(s.members).where(eq(s.members.id, uid)).limit(1);
          return (rows[0] as Member) ?? null;
        });
      },
    },

    classTypes: {
      async listByStudio(studioId: string): Promise<ClassType[]> {
        const rows = await d
          .select()
          .from(s.classTypes)
          .where(eq(s.classTypes.studioId, studioId))
          .orderBy(s.classTypes.name);
        return rows as ClassType[];
      },

      async getById(id: string): Promise<ClassType | null> {
        const rows = await d
          .select()
          .from(s.classTypes)
          .where(eq(s.classTypes.id, id))
          .limit(1);
        return (rows[0] as ClassType) ?? null;
      },

      async insert(classType: ClassType): Promise<ClassType> {
        return insertRow<ClassType>(s.classTypes, classType);
      },
    },

    classSessions: {
      async listByStudio(
        studioId: string,
        range: SessionRange = {},
      ): Promise<ClassSession[]> {
        const conditions = [eq(s.classSessions.studioId, studioId)];
        if (range.from) {
          conditions.push(sql`${s.classSessions.startsAt} >= ${range.from}`);
        }
        if (range.to) {
          conditions.push(sql`${s.classSessions.startsAt} < ${range.to}`);
        }
        const rows = await d
          .select()
          .from(s.classSessions)
          .where(and(...conditions))
          .orderBy(s.classSessions.startsAt);
        return rows as ClassSession[];
      },

      async getById(id: string): Promise<ClassSession | null> {
        const rows = await d
          .select()
          .from(s.classSessions)
          .where(eq(s.classSessions.id, id))
          .limit(1);
        return (rows[0] as ClassSession) ?? null;
      },

      async insert(session: ClassSession): Promise<ClassSession> {
        return insertRow<ClassSession>(s.classSessions, session);
      },
    },

    bookings: {
      async listBySessionIds(sessionIds: string[]): Promise<Booking[]> {
        if (sessionIds.length === 0) return [];
        const rows = await d
          .select()
          .from(s.bookings)
          .where(inArray(s.bookings.sessionId, sessionIds));
        return rows as Booking[];
      },

      async listBySession(sessionId: string): Promise<Booking[]> {
        const rows = await d
          .select()
          .from(s.bookings)
          .where(eq(s.bookings.sessionId, sessionId));
        return rows as Booking[];
      },

      async getById(id: string): Promise<Booking | null> {
        const rows = await d
          .select()
          .from(s.bookings)
          .where(eq(s.bookings.id, id))
          .limit(1);
        return (rows[0] as Booking) ?? null;
      },

      async insert(booking: Booking): Promise<Booking> {
        return insertRow<Booking>(s.bookings, booking);
      },

      async update(id: string, patch: Partial<Booking>): Promise<Booking> {
        return updateById<Booking>(s.bookings, id, patch, async (_d, uid) => {
          const rows = await d.select().from(s.bookings).where(eq(s.bookings.id, uid)).limit(1);
          return (rows[0] as Booking) ?? null;
        });
      },
    },

    invoices: {
      async listByStudio(studioId: string): Promise<Invoice[]> {
        const rows = await d
          .select()
          .from(s.invoices)
          .where(eq(s.invoices.studioId, studioId))
          .orderBy(sql`${s.invoices.issuedAt} DESC`);
        return rows as Invoice[];
      },

      async getById(id: string): Promise<Invoice | null> {
        const rows = await d
          .select()
          .from(s.invoices)
          .where(eq(s.invoices.id, id))
          .limit(1);
        return (rows[0] as Invoice) ?? null;
      },

      async countByStudio(studioId: string): Promise<number> {
        const rows = await d
          .select({ count: sql<number>`count(*)` })
          .from(s.invoices)
          .where(eq(s.invoices.studioId, studioId));
        return rows[0]?.count ?? 0;
      },

      async insert(invoice: Invoice): Promise<Invoice> {
        return insertRow<Invoice>(s.invoices, invoice);
      },

      async update(id: string, patch: Partial<Invoice>): Promise<Invoice> {
        return updateById<Invoice>(s.invoices, id, patch, async (_d, uid) => {
          const rows = await d.select().from(s.invoices).where(eq(s.invoices.id, uid)).limit(1);
          return (rows[0] as Invoice) ?? null;
        });
      },
    },

    invoiceLineItems: {
      async listByInvoice(invoiceId: string): Promise<InvoiceLineItem[]> {
        const rows = await d
          .select()
          .from(s.invoiceLineItems)
          .where(eq(s.invoiceLineItems.invoiceId, invoiceId));
        return rows as InvoiceLineItem[];
      },

      async insertMany(items: InvoiceLineItem[]): Promise<InvoiceLineItem[]> {
        return insertRows<InvoiceLineItem>(s.invoiceLineItems, items);
      },
    },

    outbox: {
      async insert(row: NotificationOutboxRow): Promise<NotificationOutboxRow> {
        return insertRow<NotificationOutboxRow>(s.notificationOutbox, row);
      },

      async listPending(): Promise<NotificationOutboxRow[]> {
        const rows = await d
          .select()
          .from(s.notificationOutbox)
          .where(isNull(s.notificationOutbox.sentAt));
        return rows as NotificationOutboxRow[];
      },

      async update(
        id: string,
        patch: Partial<NotificationOutboxRow>,
      ): Promise<NotificationOutboxRow> {
        return updateById<NotificationOutboxRow>(
          s.notificationOutbox, id, patch, async (_d, uid) => {
            const rows = await d
              .select()
              .from(s.notificationOutbox)
              .where(eq(s.notificationOutbox.id, uid))
              .limit(1);
            return (rows[0] as NotificationOutboxRow) ?? null;
          },
        );
      },
    },
  };
}