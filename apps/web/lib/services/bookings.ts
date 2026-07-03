import { and, eq } from "drizzle-orm";
import { newId } from "@/lib/db/ids";
import { bookings, classSessions, classTypes, members } from "@/lib/db/schema";
import type { ClassSession, Member } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import {
  type BookingDenyReason,
  canBook,
  canCancel,
  pickWaitlistPromotion,
} from "@/lib/domain/booking-rules";
import { computeOccupancy, isSeatTaking } from "@/lib/domain/capacity";
import { HttpError } from "@/lib/http";
import {
  bookingCancellation,
  bookingConfirmation,
  type SessionSummary,
  waitlistPromotion,
} from "@/lib/notifications/messages";
import { enqueueAndDispatch } from "@/lib/notifications/outbox";
import type { NotificationProvider } from "@/lib/notifications/types";
import type { CreateBookingInput } from "@/lib/validation";
import { getStudioContext } from "./studio";

const nowIso = (): string => new Date().toISOString();

const DENY_MESSAGES: Record<BookingDenyReason, string> = {
  session_cancelled: "This class session has been cancelled",
  session_started: "This class has already started",
  member_inactive: "This member's account is not active",
  already_booked: "This member already has a booking for this class",
  session_full_no_waitlist: "This class is full and the waitlist is closed",
};

function recipientOf(member: Member): { memberId: string; email: string; name: string } {
  return { memberId: member.id, email: member.email, name: member.name };
}

async function summaryOf(db: Db, session: ClassSession): Promise<SessionSummary> {
  const [type] = await db
    .select({ name: classTypes.name })
    .from(classTypes)
    .where(eq(classTypes.id, session.classTypeId))
    .limit(1);
  return {
    title: type?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

async function loadMember(db: Db, memberId: string): Promise<Member> {
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  return member;
}

async function loadSession(db: Db, sessionId: string): Promise<ClassSession> {
  const [session] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, sessionId))
    .limit(1);
  if (!session) throw new HttpError(404, "not_found", "Class session not found");
  return session;
}

export interface BookingResult {
  bookingId: string;
  status: "booked" | "waitlisted";
}

export async function createBooking(
  db: Db,
  provider: NotificationProvider,
  input: CreateBookingInput,
): Promise<BookingResult> {
  const { settings } = await getStudioContext(db);
  const session = await loadSession(db, input.sessionId);
  const member = await loadMember(db, input.memberId);

  const sessionBookings = await db
    .select({ status: bookings.status, memberId: bookings.memberId })
    .from(bookings)
    .where(eq(bookings.sessionId, session.id));

  const decision = canBook({
    sessionStatus: session.status,
    sessionStartsAt: session.startsAt,
    memberStatus: member.status,
    memberBookings: sessionBookings.filter((booking) => booking.memberId === member.id),
    occupancy: computeOccupancy(session.capacity, sessionBookings),
    waitlistEnabled: settings.waitlistEnabled,
    now: nowIso(),
  });
  if (!decision.ok) {
    throw new HttpError(409, `booking_${decision.reason}`, DENY_MESSAGES[decision.reason]);
  }

  const bookingId = newId("bkg");
  await db
    .insert(bookings)
    .values({ id: bookingId, sessionId: session.id, memberId: member.id, status: decision.status });

  if (decision.status === "booked") {
    await enqueueAndDispatch(
      db,
      provider,
      bookingConfirmation(recipientOf(member), await summaryOf(db, session)),
    );
  }
  return { bookingId, status: decision.status };
}

export interface CancelResult {
  refundEligible: boolean;
  promotedMemberId: string | null;
}

export async function cancelBooking(
  db: Db,
  provider: NotificationProvider,
  bookingId: string,
): Promise<CancelResult> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  const session = await loadSession(db, booking.sessionId);
  const { settings } = await getStudioContext(db);

  const decision = canCancel({
    bookingStatus: booking.status,
    sessionStartsAt: session.startsAt,
    cancellationWindowHours: settings.cancellationWindowHours,
    now: nowIso(),
  });
  if (!decision.ok) {
    const message =
      decision.reason === "already_cancelled"
        ? "This booking is already cancelled"
        : "This class has already started";
    throw new HttpError(409, `cancel_${decision.reason}`, message);
  }

  await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: nowIso() })
    .where(eq(bookings.id, bookingId));

  const promotedMemberId = isSeatTaking(booking.status)
    ? await promoteFromWaitlist(db, provider, session)
    : null;

  const member = await loadMember(db, booking.memberId);
  await enqueueAndDispatch(
    db,
    provider,
    bookingCancellation(recipientOf(member), await summaryOf(db, session), decision.refundEligible),
  );
  return { refundEligible: decision.refundEligible, promotedMemberId };
}

async function promoteFromWaitlist(
  db: Db,
  provider: NotificationProvider,
  session: ClassSession,
): Promise<string | null> {
  const waitlisted = await db
    .select({ id: bookings.id, bookedAt: bookings.bookedAt, memberId: bookings.memberId })
    .from(bookings)
    .where(and(eq(bookings.sessionId, session.id), eq(bookings.status, "waitlisted")));

  const promoteId = pickWaitlistPromotion(
    waitlisted.map((entry) => ({ id: entry.id, bookedAt: entry.bookedAt ?? "" })),
  );
  if (!promoteId) return null;

  const promoted = waitlisted.find((entry) => entry.id === promoteId);
  if (!promoted) return null;

  await db.update(bookings).set({ status: "booked" }).where(eq(bookings.id, promoteId));
  const member = await loadMember(db, promoted.memberId);
  await enqueueAndDispatch(
    db,
    provider,
    waitlistPromotion(recipientOf(member), await summaryOf(db, session)),
  );
  return promoted.memberId;
}
