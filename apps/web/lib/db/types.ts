// Plain domain row types (camelCase). These are the contract every repository
// speaks — the Supabase implementation maps them to/from snake_case Postgres
// columns, and the in-memory fakes store them directly. Domain logic and
// services depend only on these, never on any database driver.

export interface Studio {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: string;
}

export interface StudioSettings {
  studioId: string;
  currency: string;
  taxRateBps: number;
  cancellationWindowHours: number;
  waitlistEnabled: boolean;
  notifyBookingConfirmations: boolean;
  notifyCancellations: boolean;
  notifyWaitlistPromotions: boolean;
  notifyInvoices: boolean;
  notifyClassReminders: boolean;
}

export interface Member {
  id: string;
  studioId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  notificationsOptedOut: boolean;
  createdAt: string;
}

export interface ClassType {
  id: string;
  studioId: string;
  name: string;
  description: string | null;
  color: string;
  defaultCapacity: number;
  defaultPriceCents: number;
  createdAt: string;
}

export interface ClassSession {
  id: string;
  studioId: string;
  classTypeId: string;
  instructor: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  priceCents: number;
  status: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  sessionId: string;
  memberId: string;
  status: string;
  bookedAt: string;
  cancelledAt: string | null;
}

export interface Invoice {
  id: string;
  studioId: string;
  memberId: string;
  number: string;
  status: string;
  currency: string;
  taxRateBps: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  refunded: boolean;
  bookingId: string | null;
}

export interface NotificationOutboxRow {
  id: string;
  memberId: string;
  kind: string;
  payload: string;
  createdAt: string;
  sentAt: string | null;
  providerMessageId: string | null;
  error: string | null;
}
