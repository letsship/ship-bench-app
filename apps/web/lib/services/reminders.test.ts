import { describe, expect, it } from "vitest";
import { runReminders } from "./reminders";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("runReminders", () => {
  it("queues reminders for booked members in sessions within 24h", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const result = await runReminders(repos, { now: () => NOW.toISOString() });
    expect(result.queued).toBeGreaterThan(0);
    // Verify that reminder rows were created in the outbox
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.length).toBe(result.queued);
  });

  it("excludes waitlisted members", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const _result = await runReminders(repos, { now: () => NOW.toISOString() });
    // All queued reminders should be for booked status
    const reminders = await repos.outbox.listByKind("booking_reminder");
    for (const reminder of reminders) {
      const payload = JSON.parse(reminder.payload);
      const bookingId = payload.data?.bookingId;
      const booking = seed.bookings.find((b) => b.id === bookingId);
      expect(booking?.status).toBe("booked");
    }
  });

  it("excludes opted-out members", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const _result = await runReminders(repos, { now: () => NOW.toISOString() });
    // All queued reminders should be for members not opted out
    const reminders = await repos.outbox.listByKind("booking_reminder");
    for (const reminder of reminders) {
      const member = seed.members.find((m) => m.id === reminder.memberId);
      expect(member?.notificationsOptedOut).toBe(false);
    }
  });

  it("is idempotent: running twice does not queue duplicates", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const result1 = await runReminders(repos, { now: () => NOW.toISOString() });
    const result2 = await runReminders(repos, { now: () => NOW.toISOString() });
    expect(result2.queued).toBe(0);
    // Total reminders should equal the first run
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.length).toBe(result1.queued);
  });

  it("excludes sessions outside the 24h window", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    // Run at a far future date so no sessions are in the window
    const futureNow = new Date(NOW.getTime() + 100 * 24 * 60 * 60 * 1000);
    const result = await runReminders(repos, { now: () => futureNow.toISOString() });
    expect(result.queued).toBe(0);
  });
});
