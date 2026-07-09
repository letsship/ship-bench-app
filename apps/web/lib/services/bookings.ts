import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member } from "@/lib/db/types";
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
import { captureWaitlistJoined, resolveWaitlistExperimentGroup } from "@/lib/posthog/experiments";
import type { PostHogClient } from "@/lib/posthog/types";
import type { CreateBookingInput } from "@/lib/validation";
import { getStudioContext } from "./studio";

const nowIso = (): string => new Date().toISOString();

const DENY_MESSAGES: Record<BookingDenyReason, string> = {
  session_cancelled: "This class session has been cancelled",
  session_started: "This class has already started",
  member_inactive: "This member's account is not active",
  already_booked: "This member already has a booking for this class",
  session_full_no_waitlist: "This class is full and the waitlist is closed",
  session_full_experiment_control: "This class is full",
};

function recipientOf(member: Member): { memberId: string; email: string; name: string } {
  return { memberId: member.id, email: member.email, name: member.name };
}

async function summaryOf(repos: Repositories, session: ClassSession): Promise<SessionSummary> {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

async function loadMember(repos: Repositories, memberId: string): Promise<Member> {
  const member = await repos.members.getById(memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  return member;
}

async function loadSession(repos: Repositories, sessionId: string): Promise<ClassSession> {
  const session = await repos.classSessions.getById(sessionId);
  if (!session) throw new HttpError(404, "not_found", "Class session not found");
  return session;
}

export interface BookingResult {
  bookingId: string;
  status: "booked" | "waitlisted";
}

export async function createBooking(
  repos: Repositories,
  provider: NotificationProvider,
  input: CreateBookingInput,
  posthog: PostHogClient,
): Promise<BookingResult> {
  const { settings } = await getStudioContext(repos);
  const session = await loadSession(repos, input.sessionId);
  const member = await loadMember(repos, input.memberId);
  const sessionBookings = await repos.bookings.listBySession(session.id);
  const occupancy = computeOccupancy(session.capacity, sessionBookings);

  // Evaluate with a placeholder "variant" group first. The experiment group
  // only changes the outcome once every earlier deny reason (cancelled,
  // started, inactive member, already booked, no waitlist) has been ruled
  // out and the decision would otherwise be "waitlisted" — so only in that
  // case do we pay for a PostHog flag lookup.
  const decision = canBook({
    sessionStatus: session.status,
    sessionStartsAt: session.startsAt,
    memberStatus: member.status,
    memberBookings: sessionBookings.filter((booking) => booking.memberId === member.id),
    occupancy,
    waitlistEnabled: settings.waitlistEnabled,
    waitlistExperimentGroup: "variant",
    now: nowIso(),
  });
  if (decision.ok && decision.status === "waitlisted") {
    const group = await resolveWaitlistExperimentGroup(posthog, member.id);
    if (group === "control") {
      throw new HttpError(
        409,
        "booking_session_full_experiment_control",
        DENY_MESSAGES.session_full_experiment_control,
      );
    }
  }
  if (!decision.ok) {
    throw new HttpError(409, `booking_${decision.reason}`, DENY_MESSAGES[decision.reason]);
  }

  const bookingId = newId();
  await repos.bookings.insert({
    id: bookingId,
    sessionId: session.id,
    memberId: member.id,
    status: decision.status,
    bookedAt: nowIso(),
    cancelledAt: null,
  });

  if (decision.status === "booked") {
    await enqueueAndDispatch(
      repos,
      provider,
      bookingConfirmation(recipientOf(member), await summaryOf(repos, session)),
    );
  }
  if (decision.status === "waitlisted") {
    await captureWaitlistJoined(posthog, { memberId: member.id, sessionId: session.id });
  }
  return { bookingId, status: decision.status };
}

export interface CancelResult {
  refundEligible: boolean;
  promotedMemberId: string | null;
}

export async function cancelBooking(
  repos: Repositories,
  provider: NotificationProvider,
  bookingId: string,
): Promise<CancelResult> {
  const booking = await repos.bookings.getById(bookingId);
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  const session = await loadSession(repos, booking.sessionId);
  const { settings } = await getStudioContext(repos);

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

  await repos.bookings.update(bookingId, { status: "cancelled", cancelledAt: nowIso() });

  const promotedMemberId = isSeatTaking(booking.status)
    ? await promoteFromWaitlist(repos, provider, session)
    : null;

  const member = await loadMember(repos, booking.memberId);
  await enqueueAndDispatch(
    repos,
    provider,
    bookingCancellation(
      recipientOf(member),
      await summaryOf(repos, session),
      decision.refundEligible,
    ),
  );
  return { refundEligible: decision.refundEligible, promotedMemberId };
}

async function promoteFromWaitlist(
  repos: Repositories,
  provider: NotificationProvider,
  session: ClassSession,
): Promise<string | null> {
  const waitlisted = (await repos.bookings.listBySession(session.id)).filter(
    (booking) => booking.status === "waitlisted",
  );
  const promoteId = pickWaitlistPromotion(
    waitlisted.map((entry) => ({ id: entry.id, bookedAt: entry.bookedAt })),
  );
  if (!promoteId) return null;

  const promoted = waitlisted.find((entry) => entry.id === promoteId);
  if (!promoted) return null;

  await repos.bookings.update(promoteId, { status: "booked" });
  const member = await loadMember(repos, promoted.memberId);
  await enqueueAndDispatch(
    repos,
    provider,
    waitlistPromotion(recipientOf(member), await summaryOf(repos, session)),
  );
  return promoted.memberId;
}
