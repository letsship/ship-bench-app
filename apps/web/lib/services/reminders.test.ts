import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/db/seed-data";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { runReminders } from "./reminders";

const NOW = "2026-03-15T12:00:00.000Z";

describe("runReminders", () => {
  it("queues one reminder per confirmed booking and is idempotent", async () => {
    const repos = createInMemoryRepositories(buildSeed(new Date(NOW)));
    const first = await runReminders(repos, { now: NOW });
    const rows = await repos.outbox.listByKind("booking_reminder");
    const second = await runReminders(repos, { now: NOW });

    expect(first).toEqual({ queued: 11, skipped: 3 });
    expect(rows).toHaveLength(first.queued);
    expect(rows.every((row) => row.sentAt === null)).toBe(true);
    expect(second.queued).toBe(0);
    expect(second.skipped).toBe(first.queued);
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(first.queued);
  });

  it("excludes waitlisted, opted-out, and out-of-window bookings", async () => {
    const repos = createInMemoryRepositories(buildSeed(new Date(NOW)));
    const summary = await runReminders(repos, { now: "2099-01-01T00:00:00.000Z" });
    expect(summary).toEqual({ queued: 0, skipped: 0 });
    expect(await repos.outbox.listByKind("booking_reminder")).toEqual([]);
  });
});
