import { newId } from "./ids";
import type { SeedData } from "./repos/fakes";
import type {
  Booking,
  ClassPack,
  ClassSession,
  ClassType,
  Invoice,
  InvoiceLineItem,
  Member,
  NotificationOutboxRow,
  Studio,
  StudioSettings,
} from "./types";

// Single source of the demo dataset, producing plain entity rows. Consumed by
// the in-memory fakes (tests + fake-backends mode) and by scripts/emit-seed-sql
// (renders packages/db/seed.sql for Supabase). Given a `now`, sessions land on
// calendar days around today so the dashboard always has "today's classes".

const DAY_MS = 86_400_000;

function atUtc(now: Date, dayOffset: number, hour: number): string {
  const base = new Date(now.getTime() + dayOffset * DAY_MS);
  const day = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour),
  );
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

function buildStudio(now: Date): { studio: Studio; settings: StudioSettings } {
  const studioId = newId();
  return {
    studio: {
      id: studioId,
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "Europe/Amsterdam",
      createdAt: monthsAgoIso(now, 6, 1),
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

function buildMembers(now: Date, studioId: string): Member[] {
  return MEMBER_SEED.map((member, index) => ({
    id: newId(),
    studioId,
    name: member.name,
    email: member.email,
    phone: member.phone,
    status: member.status,
    // Gonzalo has opted out of all notifications — exercises the outbox skip.
    notificationsOptedOut: member.email === "gonzalo@example.com",
    createdAt: new Date(now.getTime() - (index + 1) * 15 * DAY_MS).toISOString(),
  }));
}

function buildClassTypes(now: Date, studioId: string): ClassType[] {
  return CLASS_TYPE_SEED.map((type) => ({
    id: newId(),
    studioId,
    name: type.name,
    description: `${type.name} — a ${type.kind} class at Riverbank Movement.`,
    color: type.color,
    defaultCapacity: type.capacity,
    defaultPriceCents: type.price,
    createdAt: monthsAgoIso(now, 6, 2),
  }));
}

// Three sessions a day from a week ago to a week ahead.
function buildSessions(now: Date, studioId: string, classTypes: ClassType[]): ClassSession[] {
  const sessions: ClassSession[] = [];
  let counter = 0;
  for (let dayOffset = -6; dayOffset <= 8; dayOffset += 1) {
    for (const hour of [8, 12, 17]) {
      const type = classTypes[counter % classTypes.length];
      sessions.push({
        id: newId(),
        studioId,
        classTypeId: type.id,
        instructor: INSTRUCTORS[counter % INSTRUCTORS.length],
        startsAt: atUtc(now, dayOffset, hour),
        endsAt: atUtc(now, dayOffset, hour + 1),
        capacity: type.defaultCapacity,
        priceCents: type.defaultPriceCents,
        status: "scheduled",
        createdAt: monthsAgoIso(now, 1, 1),
      });
      counter += 1;
    }
  }
  return sessions;
}

function newBooking(sessionId: string, memberId: string, status: string, now: Date): Booking {
  return {
    id: newId(),
    sessionId,
    memberId,
    status,
    bookedAt: new Date(now.getTime() - DAY_MS).toISOString(),
    cancelledAt: null,
  };
}

// Past sessions resolve to attended/no-show, future sessions to booked, and one
// near-future small session is filled to capacity with a short waitlist.
function buildBookings(now: Date, members: Member[], sessions: ClassSession[]): Booking[] {
  const bookings: Booking[] = [];
  const nowMs = now.getTime();
  sessions.forEach((session, index) => {
    const isPast = new Date(session.startsAt).getTime() < nowMs;
    const attendeeCount = Math.min(members.length, 3 + (index % 4));
    for (let i = 0; i < attendeeCount; i += 1) {
      const member = members[(index + i) % members.length];
      if (member.status !== "active") continue;
      const status = isPast ? (i % 5 === 0 ? "no_show" : "attended") : "booked";
      bookings.push(newBooking(session.id, member.id, status, now));
    }
  });
  fillWaitlistSession(now, members, sessions, bookings);
  return bookings;
}

function fillWaitlistSession(
  now: Date,
  members: Member[],
  sessions: ClassSession[],
  bookings: Booking[],
): void {
  const target = sessions.find(
    (session) => new Date(session.startsAt).getTime() > now.getTime() && session.capacity <= 8,
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
      bookings.push(newBooking(target.id, member.id, "booked", now));
      seatsLeft -= 1;
    } else if (waitlistLeft > 0) {
      bookings.push(newBooking(target.id, member.id, "waitlisted", now));
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
  {
    memberIndex: 0,
    status: "paid",
    monthsAgo: 2,
    day: 4,
    lines: [{ description: "10-class pass", quantity: 1, unit: 16000 }],
  },
  {
    memberIndex: 1,
    status: "paid",
    monthsAgo: 1,
    day: 6,
    lines: [{ description: "Monthly unlimited", quantity: 1, unit: 12000 }],
  },
  {
    memberIndex: 2,
    status: "open",
    monthsAgo: 0,
    day: 2,
    lines: [{ description: "Drop-in x4", quantity: 4, unit: 1800 }],
  },
  {
    memberIndex: 3,
    status: "paid",
    monthsAgo: 1,
    day: 12,
    lines: [
      { description: "Reformer 5-pack", quantity: 1, unit: 12000 },
      { description: "Grip socks", quantity: 1, unit: 1400 },
    ],
  },
  {
    memberIndex: 5,
    status: "refunded",
    monthsAgo: 1,
    day: 20,
    lines: [{ description: "Pottery intensive", quantity: 1, unit: 9000, refunded: true }],
  },
  {
    memberIndex: 7,
    status: "draft",
    monthsAgo: 0,
    day: 1,
    lines: [{ description: "Hand building x2", quantity: 2, unit: 3600 }],
  },
];

function buildInvoices(
  now: Date,
  studioId: string,
  members: Member[],
  taxRateBps: number,
): { invoices: Invoice[]; lineItems: InvoiceLineItem[] } {
  const invoices: Invoice[] = [];
  const lineItems: InvoiceLineItem[] = [];
  INVOICE_SEED.forEach((seed, index) => {
    const invoiceId = newId();
    const member = members[seed.memberIndex];
    let subtotal = 0;
    for (const line of seed.lines) {
      const amount = line.quantity * line.unit;
      if (!line.refunded) subtotal += amount;
      lineItems.push({
        id: newId(),
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
      createdAt: issuedAt,
    });
  });
  return { invoices, lineItems };
}

function buildOutbox(now: Date, members: Member[]): NotificationOutboxRow[] {
  const createdAt = new Date(now.getTime() - 2 * DAY_MS).toISOString();
  return [
    {
      id: newId(),
      memberId: members[0].id,
      kind: "booking_confirmation",
      payload: JSON.stringify({ subject: "You're booked", body: "See you soon!", data: {} }),
      createdAt,
      sentAt: new Date(now.getTime() - DAY_MS).toISOString(),
      providerMessageId: "re_seededdelivery0001",
      error: null,
    },
    {
      id: newId(),
      memberId: members[1].id,
      kind: "invoice_issued",
      payload: JSON.stringify({
        subject: "Invoice ready",
        body: "Your invoice is ready.",
        data: {},
      }),
      createdAt,
      sentAt: null,
      providerMessageId: null,
      error: null,
    },
  ];
}

export function buildSeed(now: Date = new Date()): SeedData {
  const { studio, settings } = buildStudio(now);
  const members = buildMembers(now, studio.id);
  const classTypes = buildClassTypes(now, studio.id);
  const sessions = buildSessions(now, studio.id, classTypes);
  const bookings = buildBookings(now, members, sessions);
  const classPacks: ClassPack[] = [];
  const { invoices, lineItems } = buildInvoices(now, studio.id, members, settings.taxRateBps);
  const outbox = buildOutbox(now, members);
  return {
    studio,
    settings,
    members,
    classTypes,
    sessions,
    bookings,
    classPacks,
    invoices,
    lineItems,
    outbox,
  };
}
