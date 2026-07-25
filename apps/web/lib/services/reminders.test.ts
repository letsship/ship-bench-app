import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/db/seed-data";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { queueClassReminders } from "./reminders";

describe("queueClassReminders", () => {
  it("queues reminders for booked members in-window", async () => {
    const now = new Date("2026-07-25T10:00:00.000Z");
    const seed = buildSeed(now);
    const repos = createInMemoryRepositories(seed);
    const provider = createFakeProvider();

    const result = await queueClassReminders(repos, provider, seed.studio.id);

    expect(result.queued).toBeGreaterThan(0);
    expect(result.skipped).toBeGreaterThanOrEqual(0);
  });

  it("skips waitlisted members", async () => {
    const now = new Date("2026-07-25T10:00:00.000Z");
    const seed = buildSeed(now);
    const repos = createInMemoryRepositories(seed);
    const provider = createFakeProvider();

    const _beforeReminders = (await repos.outbox.listByKind("booking_reminder")).length;
    await queueClassReminders(repos, provider, seed.studio.id);
    const _afterReminders = (await repos.outbox.listByKind("booking_reminder")).length;

    // Check that if there are waitlisted bookings in-window, they're not reminded
    const inWindowSessions = seed.sessions.filter((s) => {
      const startsAt = new Date(s.startsAt);
      return (
        startsAt.getTime() >= now.getTime() &&
        startsAt.getTime() < now.getTime() + 24 * 60 * 60 * 1000
      );
    });
    const inWindowSessionIds = new Set(inWindowSessions.map((s) => s.id));
    const waitlistedInWindow = seed.bookings.filter(
      (b) => b.status === "waitlisted" && inWindowSessionIds.has(b.sessionId),
    );

    if (waitlistedInWindow.length > 0) {
      const reminders = await repos.outbox.listByKind("booking_reminder");
      const reminderMemberIds = new Set<string>();
      for (const reminder of reminders) {
        try {
          const _payload = JSON.parse(reminder.payload);
          reminderMemberIds.add(reminder.memberId);
        } catch {
          // Skip malformed rows
        }
      }
      for (const waitlisted of waitlistedInWindow) {
        expect(reminderMemberIds.has(waitlisted.memberId)).toBe(false);
      }
    }
  });

  it("skips opted-out members", async () => {
    const now = new Date("2026-07-25T10:00:00.000Z");
    const seed = buildSeed(now);
    const repos = createInMemoryRepositories(seed);
    const provider = createFakeProvider();

    const optedOutMembers = seed.members.filter((m) => m.notificationsOptedOut);
    expect(optedOutMembers.length).toBeGreaterThan(0);

    await queueClassReminders(repos, provider, seed.studio.id);
    const reminders = await repos.outbox.listByKind("booking_reminder");

    for (const reminder of reminders) {
      const member = seed.members.find((m) => m.id === reminder.memberId);
      expect(member?.notificationsOptedOut).toBe(false);
    }
  });

  it("returns idempotent results on second run", async () => {
    const now = new Date("2026-07-25T10:00:00.000Z");
    const seed = buildSeed(now);
    const repos = createInMemoryRepositories(seed);
    const provider = createFakeProvider();

    const result1 = await queueClassReminders(repos, provider, seed.studio.id);
    const result2 = await queueClassReminders(repos, provider, seed.studio.id);

    expect(result2.queued).toBe(0);
    const reminders = await repos.outbox.listByKind("booking_reminder");
    expect(reminders.length).toBe(result1.queued);
  });

  it("returns { queued, skipped } summary", async () => {
    const now = new Date("2026-07-25T10:00:00.000Z");
    const seed = buildSeed(now);
    const repos = createInMemoryRepositories(seed);
    const provider = createFakeProvider();

    const result = await queueClassReminders(repos, provider, seed.studio.id);

    expect(result).toHaveProperty("queued");
    expect(result).toHaveProperty("skipped");
    expect(typeof result.queued).toBe("number");
    expect(typeof result.skipped).toBe("number");
  });
});
