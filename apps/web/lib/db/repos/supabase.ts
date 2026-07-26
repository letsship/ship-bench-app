import { createServiceClient } from "@/lib/supabase/service";
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
import { toCamelRow, toSnakeRow } from "./mapping";
import { DuplicateActiveBookingError, type Repositories } from "./types";

// The production repository implementation over supabase-js (service role).
// Reads come back snake_case and are mapped to camelCase entities; writes map
// the other way. This is the ONE file a Supabase→other-database migration
// rewrites — nothing above the repository interface changes.

const PG_UNIQUE_VIOLATION = "23505";

type PgError = { message: string; code?: string } | null;
type ListResponse = PromiseLike<{ data: unknown[] | null; error: PgError }>;
type SingleResponse = PromiseLike<{ data: Record<string, unknown> | null; error: PgError }>;

function fail(context: string, error: { message: string }): never {
  throw new Error(`Supabase ${context} failed: ${error.message}`);
}

async function rows<T>(query: ListResponse, context: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(context, error);
  return (data ?? []).map((row) => toCamelRow<T>(row as Record<string, unknown>));
}

async function maybeOne<T>(query: SingleResponse, context: string): Promise<T | null> {
  const { data, error } = await query;
  if (error) fail(context, error);
  return data ? toCamelRow<T>(data) : null;
}

export function createSupabaseRepositories(): Repositories {
  const db = createServiceClient();

  async function insertReturning<T>(table: string, row: T): Promise<T> {
    const { data, error } = await db
      .from(table)
      .insert(toSnakeRow(row as Record<string, unknown>))
      .select()
      .single();
    if (error) fail(`insert into ${table}`, error);
    return toCamelRow<T>(data as Record<string, unknown>);
  }

  async function insertBooking(booking: Booking): Promise<Booking> {
    const { data, error } = await db
      .from("bookings")
      .insert(toSnakeRow(booking as unknown as Record<string, unknown>))
      .select()
      .single();
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        throw new DuplicateActiveBookingError(booking.sessionId, booking.memberId);
      }
      fail("insert into bookings", error);
    }
    return toCamelRow<Booking>(data as Record<string, unknown>);
  }

  async function updateReturning<T>(
    table: string,
    column: string,
    value: string,
    patch: Partial<T>,
  ): Promise<T> {
    const { data, error } = await db
      .from(table)
      .update(toSnakeRow(patch as Record<string, unknown>))
      .eq(column, value)
      .select()
      .single();
    if (error) fail(`update ${table}`, error);
    return toCamelRow<T>(data as Record<string, unknown>);
  }

  return {
    studios: {
      getFirst: () =>
        maybeOne<Studio>(db.from("studios").select("*").limit(1).maybeSingle(), "studios.getFirst"),
    },
    settings: {
      getByStudioId: (studioId) =>
        maybeOne<StudioSettings>(
          db.from("studio_settings").select("*").eq("studio_id", studioId).maybeSingle(),
          "settings.getByStudioId",
        ),
      update: (studioId, patch) =>
        updateReturning<StudioSettings>("studio_settings", "studio_id", studioId, patch),
    },
    members: {
      listByStudio: (studioId) =>
        rows<Member>(
          db.from("members").select("*").eq("studio_id", studioId).order("name"),
          "members.listByStudio",
        ),
      getById: (id) =>
        maybeOne<Member>(
          db.from("members").select("*").eq("id", id).maybeSingle(),
          "members.getById",
        ),
      findByEmail: (studioId, email) =>
        maybeOne<Member>(
          db.from("members").select("*").eq("studio_id", studioId).eq("email", email).maybeSingle(),
          "members.findByEmail",
        ),
      insert: (member) => insertReturning("members", member),
      update: (id, patch) => updateReturning<Member>("members", "id", id, patch),
    },
    classTypes: {
      listByStudio: (studioId) =>
        rows<ClassType>(
          db.from("class_types").select("*").eq("studio_id", studioId).order("name"),
          "classTypes.listByStudio",
        ),
      getById: (id) =>
        maybeOne<ClassType>(
          db.from("class_types").select("*").eq("id", id).maybeSingle(),
          "classTypes.getById",
        ),
      insert: (classType) => insertReturning("class_types", classType),
    },
    classSessions: {
      listByStudio: (studioId, range = {}) => {
        let query = db.from("class_sessions").select("*").eq("studio_id", studioId);
        if (range.from) query = query.gte("starts_at", range.from);
        if (range.to) query = query.lt("starts_at", range.to);
        return rows<ClassSession>(query.order("starts_at"), "classSessions.listByStudio");
      },
      getById: (id) =>
        maybeOne<ClassSession>(
          db.from("class_sessions").select("*").eq("id", id).maybeSingle(),
          "classSessions.getById",
        ),
      insert: (session) => insertReturning("class_sessions", session),
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return rows<Booking>(
          db.from("bookings").select("*").in("session_id", sessionIds),
          "bookings.listBySessionIds",
        );
      },
      listBySession: (sessionId) =>
        rows<Booking>(
          db.from("bookings").select("*").eq("session_id", sessionId),
          "bookings.listBySession",
        ),
      getById: (id) =>
        maybeOne<Booking>(
          db.from("bookings").select("*").eq("id", id).maybeSingle(),
          "bookings.getById",
        ),
      insert: (booking) => insertBooking(booking),
      update: (id, patch) => updateReturning<Booking>("bookings", "id", id, patch),
    },
    invoices: {
      listByStudio: (studioId) =>
        rows<Invoice>(
          db
            .from("invoices")
            .select("*")
            .eq("studio_id", studioId)
            .order("issued_at", { ascending: false }),
          "invoices.listByStudio",
        ),
      getById: (id) =>
        maybeOne<Invoice>(
          db.from("invoices").select("*").eq("id", id).maybeSingle(),
          "invoices.getById",
        ),
      countByStudio: async (studioId) => {
        const { count, error } = await db
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("studio_id", studioId);
        if (error) fail("invoices.countByStudio", error);
        return count ?? 0;
      },
      insert: (invoice) => insertReturning("invoices", invoice),
      update: (id, patch) => updateReturning<Invoice>("invoices", "id", id, patch),
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        rows<InvoiceLineItem>(
          db.from("invoice_line_items").select("*").eq("invoice_id", invoiceId),
          "invoiceLineItems.listByInvoice",
        ),
      insertMany: async (items) => {
        if (items.length === 0) return [];
        const { data, error } = await db
          .from("invoice_line_items")
          .insert(items.map((item) => toSnakeRow(item as unknown as Record<string, unknown>)))
          .select();
        if (error) fail("invoiceLineItems.insertMany", error);
        return (data ?? []).map((row) =>
          toCamelRow<InvoiceLineItem>(row as Record<string, unknown>),
        );
      },
    },
    outbox: {
      insert: (row) => insertReturning("notification_outbox", row),
      listPending: () =>
        rows<NotificationOutboxRow>(
          db.from("notification_outbox").select("*").is("sent_at", null),
          "outbox.listPending",
        ),
      update: (id, patch) =>
        updateReturning<NotificationOutboxRow>("notification_outbox", "id", id, patch),
    },
  };
}
