import { newId } from "./ids";
import type {
  NewBooking,
  NewClassSession,
  NewClassType,
  NewInvoice,
  NewInvoiceLineItem,
  NewMember,
  NewNotificationOutboxRow,
  NewStudio,
} from "./schema";
import type { StudioSettings } from "./schema";

// Single source of the demo dataset. Consumed by scripts/seed.ts (inserts into
// the local sqlite database) and scripts/emit-seed-sql.ts (renders drizzle/
// seed.sql for the ephemeral preview D1). Given a `now`, sessions are placed on
// calendar days around today so the dashboard always has "today's classes".

export interface SeedData {
  studio: NewStudio;
  settings: StudioSettings;
  members: NewMember[];
  classTypes: NewClassType[];
  sessions: NewClassSession[];
  bookings: NewBooking[];
  invoices: NewInvoice[];
  lineItems: NewInvoiceLineItem[];
  outbox: NewNotificationOutboxRow[];
}

// Class types with the required-at-build fields narrowed to non-optional, so
// sessions can read capacity/price without undefined checks.
type SeededClassType = NewClassType & {
  id: string;
  defaultCapacity: number;
  defaultPriceCents: number;
};

const DAY_MS = 86_400_000;

function atUtc(now: Date, dayOffset: number, hour: number): string {
  const base = new Date(now.getTime() + dayOffset * DAY_MS);
  const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour));
  return day.toISOString();
}

function monthsAgoIso(now: Date, months: number, day: number): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, day, 9)).toISOString();
}

const MEMBER_SEED = [
  { name: "Amara Okafor", email: "amara@example.com", phone: "+31 6 1200 0001", status: "active" },
  { name: "Bram de Vries", email: "bram@example.com", phone: "+31 6 1200 0002", status: "active" },
  { name: "Chiara Rossi", email: "chiara@example.com", phone: null, status: "active" },
  { name: "Deshi Tan", email: "deshi@example.com", phone: "+31 6 1200 0004", status: "active" },
  { name: "Elif Yılmaz", email: "elif@example.com", phone: null, status: "paused" },
  { name: "Femke Jansen", email: "femke@example.com", phone: "+31 6 1200 0006", status: "active" },
  { name: "Gonzalo Marín", email: "gonzalo@example.com", phone: null, status: "active" },
  { name: "Hana Kovač", email: "hana@example.com", phone: "+31 6 1200 0008", status: "active" },
] as const;

const CLASS_TYPE_SEED = [
  { name: "Vinyasa Flow", color: "#5b8c5a", capacity: 16, price: 1800, kind: "yoga" },
  { name: "Yin & Restore", color: "#7d6b91", capacity: 14, price: 1800, kind: "yoga" },
  { name: "Reformer Pilates", color: "#3f6f9f", capacity: 8, price: 2600, kind: "pilates" },
  { name: "Wheel Throwing", color: "#b5623a", capacity: 6, price: 4200, kind: "pottery" },
  { name: "Hand Building", color: "#c98a3c", capacity: 10, price: 3600, kind: "pottery" },
] as const;

const INSTRUCTORS = ["Noor", "Sanne", "Tomás", "Priya", "Wouter"] as const;

function buildStudio(): { studio: NewStudio; settings: StudioSettings } {
  const studioId = newId("stu");
  return {
    studio: {
      id: studioId,
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "Europe/Amsterdam",
    },
    settings: {
      studioId,
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
  };
}

function buildMembers(studioId: string): NewMember[] {
  return MEMBER_SEED.map((member) => ({
    id: newId("mem"),
    studioId,
    name: member.name,
    email: member.email,
    phone: member.phone,
    status: member.status,
    // Gonzalo has opted out of all notifications — exercises the outbox skip.
    notificationsOptedOut: member.email === "gonzalo@example.com",
  }));
}

function buildClassTypes(studioId: string): SeededClassType[] {
  return CLASS_TYPE_SEED.map((type) => ({
    id: newId("ct"),
    studioId,
    name: type.name,
    description: `${type.name} — a ${type.kind} class at Riverbank Movement.`,
    color: type.color,
    defaultCapacity: type.capacity,
    defaultPriceCents: type.price,
  }));
}

// Three sessions a day from a week ago to a week ahead.
function buildSessions(now: Date, studioId: string, classTypes: SeededClassType[]): NewClassSession[] {
  const sessions: NewClassSession[] = [];
  let counter = 0;
  for (let dayOffset = -6; dayOffset <= 8; dayOffset += 1) {
    for (const hour of [8, 12, 17]) {
      const type = classTypes[counter % classTypes.length];
      sessions.push({
        id: newId("cs"),
        studioId,
        classTypeId: type.id,
        instructor: INSTRUCTORS[counter % INSTRUCTORS.length],
        startsAt: atUtc(now, dayOffset, hour),
        endsAt: atUtc(now, dayOffset, hour + 1),
        capacity: type.defaultCapacity,
        priceCents: type.defaultPriceCents,
        status: "scheduled",
      });
      counter += 1;
    }
  }
  return sessions;
}

// Book members onto sessions: past sessions resolve to attended/no-show, future
// sessions to booked, and one near-future session is filled to capacity with a
// short waitlist to exercise occupancy + waitlist logic.
function buildBookings(
  now: Date,
  members: NewMember[],
  sessions: NewClassSession[],
): NewBooking[] {
  const bookings: NewBooking[] = [];
  const nowMs = now.getTime();
  sessions.forEach((session, index) => {
    const isPast = new Date(session.startsAt).getTime() < nowMs;
    const attendeeCount = Math.min(members.length, 3 + (index % 4));
    for (let i = 0; i < attendeeCount; i += 1) {
      const member = members[(index + i) % members.length];
      if (member.status !== "active") continue;
      let status = "booked";
      if (isPast) status = i % 5 === 0 ? "no_show" : "attended";
      bookings.push({
        id: newId("bkg"),
        sessionId: session.id,
        memberId: member.id,
        status,
        cancelledAt: null,
      });
    }
  });
  fillWaitlistSession(members, sessions, bookings, nowMs);
  return bookings;
}

// Find the first upcoming small-capacity session and fill it plus a waitlist.
function fillWaitlistSession(
  members: NewMember[],
  sessions: NewClassSession[],
  bookings: NewBooking[],
  nowMs: number,
): void {
  const target = sessions.find(
    (session) => new Date(session.startsAt).getTime() > nowMs && session.capacity <= 8,
  );
  if (!target) return;
  const active = members.filter((member) => member.status === "active");
  const existing = new Set(
    bookings.filter((b) => b.sessionId === target.id).map((b) => b.memberId),
  );
  let seatsLeft = target.capacity - existing.size;
  let waitlistLeft = 2;
  for (const member of active) {
    if (existing.has(member.id)) continue;
    if (seatsLeft > 0) {
      bookings.push({ id: newId("bkg"), sessionId: target.id, memberId: member.id, status: "booked", cancelledAt: null });
      seatsLeft -= 1;
    } else if (waitlistLeft > 0) {
      bookings.push({ id: newId("bkg"), sessionId: target.id, memberId: member.id, status: "waitlisted", cancelledAt: null });
      waitlistLeft -= 1;
    }
  }
}

interface InvoiceSeed {
  memberIndex: number;
  status: string;
  monthsAgo: number;
  day: number;
  lines: { description: string; quantity: number; unit: number; refunded?: boolean }[];
}

const INVOICE_SEED: InvoiceSeed[] = [
  { memberIndex: 0, status: "paid", monthsAgo: 2, day: 4, lines: [{ description: "10-class pass", quantity: 1, unit: 16000 }] },
  { memberIndex: 1, status: "paid", monthsAgo: 1, day: 6, lines: [{ description: "Monthly unlimited", quantity: 1, unit: 12000 }] },
  { memberIndex: 2, status: "open", monthsAgo: 0, day: 2, lines: [{ description: "Drop-in x4", quantity: 4, unit: 1800 }] },
  { memberIndex: 3, status: "paid", monthsAgo: 1, day: 12, lines: [{ description: "Reformer 5-pack", quantity: 1, unit: 12000 }, { description: "Grip socks", quantity: 1, unit: 1400 }] },
  { memberIndex: 5, status: "refunded", monthsAgo: 1, day: 20, lines: [{ description: "Pottery intensive", quantity: 1, unit: 9000, refunded: true }] },
  { memberIndex: 7, status: "draft", monthsAgo: 0, day: 1, lines: [{ description: "Hand building x2", quantity: 2, unit: 3600 }] },
];

function buildInvoices(
  now: Date,
  studioId: string,
  members: NewMember[],
  taxRateBps: number,
): { invoices: NewInvoice[]; lineItems: NewInvoiceLineItem[] } {
  const invoices: NewInvoice[] = [];
  const lineItems: NewInvoiceLineItem[] = [];
  INVOICE_SEED.forEach((seed, index) => {
    const invoiceId = newId("inv");
    const member = members[seed.memberIndex];
    let subtotal = 0;
    for (const line of seed.lines) {
      const amount = line.quantity * line.unit;
      if (!line.refunded) subtotal += amount;
      lineItems.push({
        id: newId("ili"),
        invoiceId,
        description: line.description,
        quantity: line.quantity,
        unitAmountCents: line.unit,
        amountCents: amount,
        refunded: line.refunded ?? false,
        bookingId: null,
      });
    }
    const tax = Math.round((subtotal * taxRateBps) / 10_000);
    const issuedAt = monthsAgoIso(now, seed.monthsAgo, seed.day);
    invoices.push({
      id: invoiceId,
      studioId,
      memberId: member.id,
      number: `INV-${new Date(issuedAt).getUTCFullYear()}-${String(index + 1).padStart(4, "0")}`,
      status: seed.status,
      currency: "EUR",
      taxRateBps,
      subtotalCents: subtotal,
      taxCents: tax,
      totalCents: subtotal + tax,
      issuedAt,
      dueAt: new Date(new Date(issuedAt).getTime() + 14 * DAY_MS).toISOString(),
      paidAt: seed.status === "paid" ? issuedAt : null,
    });
  });
  return { invoices, lineItems };
}

function buildOutbox(now: Date, members: NewMember[]): NewNotificationOutboxRow[] {
  const sentAt = new Date(now.getTime() - DAY_MS).toISOString();
  return [
    {
      id: newId("nof"),
      memberId: members[0].id,
      kind: "booking_confirmation",
      payload: JSON.stringify({ subject: "You're booked", body: "See you soon!", data: {} }),
      sentAt,
      providerMessageId: "mj_seededdelivery0001",
    },
    {
      id: newId("nof"),
      memberId: members[1].id,
      kind: "invoice_issued",
      payload: JSON.stringify({ subject: "Invoice ready", body: "Your invoice is ready.", data: {} }),
      sentAt: null,
    },
  ];
}

export function buildSeed(now: Date = new Date()): SeedData {
  const { studio, settings } = buildStudio();
  const members = buildMembers(studio.id);
  const classTypes = buildClassTypes(studio.id);
  const sessions = buildSessions(now, studio.id, classTypes);
  const bookings = buildBookings(now, members, sessions);
  const { invoices, lineItems } = buildInvoices(now, studio.id, members, settings.taxRateBps);
  const outbox = buildOutbox(now, members);
  return { studio, settings, members, classTypes, sessions, bookings, invoices, lineItems, outbox };
}
