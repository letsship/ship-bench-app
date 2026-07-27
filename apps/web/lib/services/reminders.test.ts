import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { runReminders } from "./reminders";

const NOW = new Date("2026-07-01T12:00:00.000Z");

describe("runReminders", () => {
  it("queues a booking_reminder for a confirmed seat in a session within 24h", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const summary = await runReminders(repos, { now: () => NOW.toISOString() });

    expect(summary.queued).toBeGreaterThan(0);
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.length).toBe(summary.queued);
    expect(reminders[0].kind).toBe("booking_reminder");
  });

  it("includes bookingId in the outbox row data for idempotency", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    await runReminders(repos, { now: () => NOW.toISOString() });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.length).toBeGreaterThan(0);

    const payload = JSON.parse(reminders[0].payload);
    expect(payload.data).toHaveProperty("bookingId");
  });

  it("does not queue a reminder for waitlisted members", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const _summary = await runReminders(repos, { now: () => NOW.toISOString() });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    const allBookings = await repos.bookings.listBySessionIds(
      (await repos.classSessions.listByStudio((await repos.studios.getFirst())!.id)).map(
        (s) => s.id,
      ),
    );

    const waitlistedBookingIds = new Set(
      allBookings.filter((b) => b.status === "waitlisted").map((b) => b.id),
    );

    for (const reminder of reminders) {
      const payload = JSON.parse(reminder.payload);
      expect(waitlistedBookingIds.has(payload.data.bookingId)).toBe(false);
    }
  });

  it("does not queue a reminder for members who opted out", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const optedOutMembers = (await repos.members.listByStudio((await repos.studios.getFirst())!.id))
      .filter((m) => m.notificationsOptedOut)
      .map((m) => m.id);

    const _summary = await runReminders(repos, { now: () => NOW.toISOString() });

    const reminders = await repos.outbox.listByKind("booking_reminder");
    for (const reminder of reminders) {
      expect(optedOutMembers.includes(reminder.memberId)).toBe(false);
    }
  });

  it("does not queue a reminder for sessions outside the 24h window", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const _summary = await runReminders(repos, { now: () => NOW.toISOString() });

    const reminders = await repos.outbox.listByKind("booking_reminder");

    const studio = (await repos.studios.getFirst())!;
    const _sessions = await repos.classSessions.listByStudio(studio.id);

    for (const reminder of reminders) {
      const payload = JSON.parse(reminder.payload);
      const startsAt = payload.data.startsAt;

      const nowMs = NOW.getTime();
      const startsAtMs = new Date(startsAt).getTime();
      const withinWindow = startsAtMs >= nowMs && startsAtMs < nowMs + 24 * 60 * 60 * 1000;

      expect(withinWindow).toBe(true);
    }
  });

  it("is idempotent: does not queue duplicate reminders", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));

    const summary1 = await runReminders(repos, { now: () => NOW.toISOString() });
    const count1 = (await repos.outbox.listByKind("booking_reminder")).length;

    const summary2 = await runReminders(repos, { now: () => NOW.toISOString() });
    const count2 = (await repos.outbox.listByKind("booking_reminder")).length;

    expect(count1).toBe(summary1.queued);
    expect(count2).toBe(count1);
    expect(summary2.queued).toBe(0);
    expect(summary2.skipped).toBeGreaterThan(0);
  });

  it("does not queue a reminder for already-sent bookings", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));

    const _summary1 = await runReminders(repos, { now: () => NOW.toISOString() });
    const reminders1 = await repos.outbox.listByKind("booking_reminder");
    expect(reminders1.length).toBeGreaterThan(0);

    const sentAt = new Date(NOW.getTime() - 1000).toISOString();
    for (const reminder of reminders1) {
      await repos.outbox.update(reminder.id, { sentAt });
    }

    const summary2 = await runReminders(repos, { now: () => NOW.toISOString() });
    expect(summary2.queued).toBe(0);
    const reminders2 = await repos.outbox.listByKind("booking_reminder");
    expect(reminders2.length).toBe(reminders1.length);
  });
});
