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

// The repository seam. Route handlers, services, and the outbox depend ONLY on
// these interfaces — never on supabase-js (or any driver) directly. Two
// implementations exist: `supabase/` (the production Postgres impl) and
// `fakes.ts` (in-memory, for hermetic tests + the local fake-backends mode).
// Swapping the persistence layer means writing a new set of these; nothing
// upstream changes. Services build full rows (ids + timestamps set app-side)
// so both implementations behave identically.

export interface SessionRange {
  from?: string;
  to?: string;
}

export interface StudioRepo {
  getFirst(): Promise<Studio | null>;
}

export interface StudioSettingsRepo {
  getByStudioId(studioId: string): Promise<StudioSettings | null>;
  update(studioId: string, patch: Partial<StudioSettings>): Promise<StudioSettings>;
}

export interface MembersRepo {
  listByStudio(studioId: string): Promise<Member[]>;
  getById(id: string): Promise<Member | null>;
  findByEmail(studioId: string, email: string): Promise<Member | null>;
  insert(member: Member): Promise<Member>;
  update(id: string, patch: Partial<Member>): Promise<Member>;
}

export interface ClassTypesRepo {
  listByStudio(studioId: string): Promise<ClassType[]>;
  getById(id: string): Promise<ClassType | null>;
  insert(classType: ClassType): Promise<ClassType>;
}

export interface ClassSessionsRepo {
  listByStudio(studioId: string, range?: SessionRange): Promise<ClassSession[]>;
  getById(id: string): Promise<ClassSession | null>;
  insert(session: ClassSession): Promise<ClassSession>;
}

export interface BookingsRepo {
  listBySessionIds(sessionIds: string[]): Promise<Booking[]>;
  listBySession(sessionId: string): Promise<Booking[]>;
  getById(id: string): Promise<Booking | null>;
  insert(booking: Booking): Promise<Booking>;
  update(id: string, patch: Partial<Booking>): Promise<Booking>;
}

export interface InvoicesRepo {
  listByStudio(studioId: string): Promise<Invoice[]>;
  getById(id: string): Promise<Invoice | null>;
  countByStudio(studioId: string): Promise<number>;
  insert(invoice: Invoice): Promise<Invoice>;
  update(id: string, patch: Partial<Invoice>): Promise<Invoice>;
}

export interface InvoiceLineItemsRepo {
  listByInvoice(invoiceId: string): Promise<InvoiceLineItem[]>;
  insertMany(items: InvoiceLineItem[]): Promise<InvoiceLineItem[]>;
}

export interface NotificationOutboxRepo {
  insert(row: NotificationOutboxRow): Promise<NotificationOutboxRow>;
  listByKind(kind: string): Promise<NotificationOutboxRow[]>;
  listPending(): Promise<NotificationOutboxRow[]>;
  update(id: string, patch: Partial<NotificationOutboxRow>): Promise<NotificationOutboxRow>;
}

export interface Repositories {
  studios: StudioRepo;
  settings: StudioSettingsRepo;
  members: MembersRepo;
  classTypes: ClassTypesRepo;
  classSessions: ClassSessionsRepo;
  bookings: BookingsRepo;
  invoices: InvoicesRepo;
  invoiceLineItems: InvoiceLineItemsRepo;
  outbox: NotificationOutboxRepo;
}
