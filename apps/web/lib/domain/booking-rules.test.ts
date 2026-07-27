import { describe, expect, it } from "vitest";
import { canBook, canCancel, pickWaitlistPromotion } from "./booking-rules";
import { computeOccupancy } from "./capacity";

const FUTURE = "2026-06-01T09:00:00Z";
const NOW = "2026-05-30T09:00:00Z";

function baseContext(overrides: Partial<Parameters<typeof canBook>[0]> = {}) {
  return {
    sessionStatus: "scheduled",
    sessionStartsAt: FUTURE,
    memberStatus: "active",
    memberBookings: [],
    occupancy: computeOccupancy(10, []),
    waitlistEnabled: true,
    now: NOW,
    ...overrides,
  };
}

describe("canBook", () => {
  it("confirms a booking when there is room", () => {
    expect(canBook(baseContext())).toEqual({ ok: true, status: "booked" });
  });

  it("waitlists when full and the waitlist is open", () => {
    const occupancy = computeOccupancy(1, [{ status: "booked" }]);
    expect(canBook(baseContext({ occupancy }))).toEqual({ ok: true, status: "waitlisted" });
  });

  it("rejects a cancelled session", () => {
    expect(canBook(baseContext({ sessionStatus: "cancelled" }))).toEqual({
      ok: false,
      reason: "session_cancelled",
    });
  });

  it("rejects a session that already started", () => {
    expect(canBook(baseContext({ now: "2026-06-01T10:00:00Z" }))).toEqual({
      ok: false,
      reason: "session_started",
    });
  });

  it("rejects an inactive member", () => {
    expect(canBook(baseContext({ memberStatus: "paused" }))).toEqual({
      ok: false,
      reason: "member_inactive",
    });
  });

  it("rejects a member who already holds a booking", () => {
    expect(canBook(baseContext({ memberBookings: [{ status: "booked" }] }))).toEqual({
      ok: false,
      reason: "already_booked",
    });
  });

  it("rejects a repeat attempt while the member is already waitlisted", () => {
    const occupancy = computeOccupancy(1, [{ status: "booked" }]);
    expect(canBook(baseContext({ occupancy, memberBookings: [{ status: "waitlisted" }] }))).toEqual(
      { ok: false, reason: "already_booked" },
    );
  });

  it("allows re-booking after the member's prior booking was cancelled", () => {
    expect(canBook(baseContext({ memberBookings: [{ status: "cancelled" }] }))).toEqual({
      ok: true,
      status: "booked",
    });
  });

  it("rejects when full and the waitlist is closed", () => {
    const occupancy = computeOccupancy(1, [{ status: "booked" }]);
    expect(canBook(baseContext({ occupancy, waitlistEnabled: false }))).toEqual({
      ok: false,
      reason: "session_full_no_waitlist",
    });
  });
});

describe("canCancel", () => {
  it("allows cancellation with a refund outside the window", () => {
    expect(
      canCancel({
        bookingStatus: "booked",
        sessionStartsAt: FUTURE,
        cancellationWindowHours: 12,
        now: NOW,
      }),
    ).toEqual({ ok: true, refundEligible: true });
  });

  it("allows cancellation without a refund inside the window", () => {
    expect(
      canCancel({
        bookingStatus: "booked",
        sessionStartsAt: "2026-05-30T15:00:00Z",
        cancellationWindowHours: 12,
        now: NOW,
      }),
    ).toEqual({ ok: true, refundEligible: false });
  });

  it("treats exactly the window boundary as refundable", () => {
    expect(
      canCancel({
        bookingStatus: "booked",
        sessionStartsAt: "2026-05-30T21:00:00Z", // exactly 12h after NOW
        cancellationWindowHours: 12,
        now: NOW,
      }),
    ).toEqual({ ok: true, refundEligible: true });
  });

  it("rejects an already-cancelled booking", () => {
    expect(
      canCancel({
        bookingStatus: "cancelled",
        sessionStartsAt: FUTURE,
        cancellationWindowHours: 12,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "already_cancelled" });
  });

  it("rejects cancellation after the session started", () => {
    expect(
      canCancel({
        bookingStatus: "booked",
        sessionStartsAt: "2026-05-30T08:00:00Z",
        cancellationWindowHours: 12,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "session_passed" });
  });
});

describe("pickWaitlistPromotion", () => {
  it("promotes the earliest booked waitlist entry", () => {
    const id = pickWaitlistPromotion([
      { id: "b", bookedAt: "2026-01-02T00:00:00Z" },
      { id: "a", bookedAt: "2026-01-01T00:00:00Z" },
      { id: "c", bookedAt: "2026-01-03T00:00:00Z" },
    ]);
    expect(id).toBe("a");
  });

  it("returns null for an empty waitlist", () => {
    expect(pickWaitlistPromotion([])).toBeNull();
  });
});
