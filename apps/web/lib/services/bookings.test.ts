import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/local-db";
import { bookings, members } from "@/lib/db/schema";
import { setupScenario, testProvider } from "@/lib/test-support";
import { cancelBooking, createBooking } from "./bookings";

describe("createBooking", () => {
  it("confirms a booking and sends a confirmation", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { capacity: 10 });
    const { provider, transport } = testProvider();
    const result = await createBooking(db, provider, {
      sessionId: scenario.sessionId,
      memberId: scenario.memberA,
    });
    expect(result.status).toBe("booked");
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].tags).toEqual(["booking_confirmation"]);
  });

  it("waitlists when full and sends no confirmation", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { capacity: 1, waitlistEnabled: true });
    const { provider, transport } = testProvider();
    await createBooking(db, provider, { sessionId: scenario.sessionId, memberId: scenario.memberA });
    const result = await createBooking(db, provider, {
      sessionId: scenario.sessionId,
      memberId: scenario.memberB,
    });
    expect(result.status).toBe("waitlisted");
    expect(transport.sent).toHaveLength(1);
  });

  it("rejects a full session when the waitlist is closed", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { capacity: 1, waitlistEnabled: false });
    const { provider } = testProvider();
    await createBooking(db, provider, { sessionId: scenario.sessionId, memberId: scenario.memberA });
    await expect(
      createBooking(db, provider, { sessionId: scenario.sessionId, memberId: scenario.memberB }),
    ).rejects.toMatchObject({ status: 409, code: "booking_session_full_no_waitlist" });
  });

  it("rejects a double booking", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { capacity: 10 });
    const { provider } = testProvider();
    await createBooking(db, provider, { sessionId: scenario.sessionId, memberId: scenario.memberA });
    await expect(
      createBooking(db, provider, { sessionId: scenario.sessionId, memberId: scenario.memberA }),
    ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });
  });

  it("rejects a session that already started", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { startsInHours: -2 });
    const { provider } = testProvider();
    await expect(
      createBooking(db, provider, { sessionId: scenario.sessionId, memberId: scenario.memberA }),
    ).rejects.toMatchObject({ code: "booking_session_started" });
  });

  it("rejects an inactive member", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { capacity: 10 });
    await db.update(members).set({ status: "paused" }).where(eq(members.id, scenario.memberA));
    const { provider } = testProvider();
    await expect(
      createBooking(db, provider, { sessionId: scenario.sessionId, memberId: scenario.memberA }),
    ).rejects.toMatchObject({ code: "booking_member_inactive" });
  });
});

describe("cancelBooking", () => {
  it("refunds a cancellation outside the window", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { startsInHours: 48, cancellationWindowHours: 12 });
    const { provider } = testProvider();
    const { bookingId } = await createBooking(db, provider, {
      sessionId: scenario.sessionId,
      memberId: scenario.memberA,
    });
    const result = await cancelBooking(db, provider, bookingId);
    expect(result.refundEligible).toBe(true);
  });

  it("does not refund inside the window", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { startsInHours: 6, cancellationWindowHours: 12 });
    const { provider } = testProvider();
    const { bookingId } = await createBooking(db, provider, {
      sessionId: scenario.sessionId,
      memberId: scenario.memberA,
    });
    const result = await cancelBooking(db, provider, bookingId);
    expect(result.refundEligible).toBe(false);
  });

  it("promotes the earliest waitlisted member when a seat frees", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { capacity: 1, waitlistEnabled: true });
    const { provider, transport } = testProvider();
    const booked = await createBooking(db, provider, {
      sessionId: scenario.sessionId,
      memberId: scenario.memberA,
    });
    await createBooking(db, provider, { sessionId: scenario.sessionId, memberId: scenario.memberB });
    transport.sent.length = 0;

    const result = await cancelBooking(db, provider, booked.bookingId);
    expect(result.promotedMemberId).toBe(scenario.memberB);
    const promoted = await db.select().from(bookings).where(eq(bookings.memberId, scenario.memberB));
    expect(promoted[0].status).toBe("booked");
    expect(transport.sent.map((message) => message.tags?.[0])).toContain("waitlist_promotion");
  });

  it("rejects cancelling an already-cancelled booking", async () => {
    const db = createTestDb();
    const scenario = await setupScenario(db, { capacity: 10 });
    const { provider } = testProvider();
    const { bookingId } = await createBooking(db, provider, {
      sessionId: scenario.sessionId,
      memberId: scenario.memberA,
    });
    await cancelBooking(db, provider, bookingId);
    await expect(cancelBooking(db, provider, bookingId)).rejects.toMatchObject({
      code: "cancel_already_cancelled",
    });
  });
});
