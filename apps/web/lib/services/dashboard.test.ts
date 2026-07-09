import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { formatDayLabel } from "@/lib/format";
import { getDashboard } from "./dashboard";
import { getStudioContext } from "./studio";

const ISO = "2026-01-01T00:00:00.000Z";

function seedWithTimezone(timezone: string): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone, createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("getDashboard todayLabel", () => {
  // 22:30 UTC on 14 June is already 00:30 on 15 June in Amsterdam (CEST, UTC+2)
  // — the exact "early morning, wrong day" scenario from the support report.
  const nearMidnightAmsterdam = "2026-06-14T22:30:00.000Z";

  it("derives todayLabel from the injected now and the studio's timezone, not UTC", async () => {
    const repos = createInMemoryRepositories(seedWithTimezone("Europe/Amsterdam"));
    const ctx = await getStudioContext(repos);

    const data = await getDashboard(repos, ctx, { now: () => nearMidnightAmsterdam });

    expect(data.todayLabel).toBe(formatDayLabel(nearMidnightAmsterdam, "Europe/Amsterdam"));
    expect(data.todayLabel).toBe("Monday 15 June");
    expect(data.todayLabel).not.toBe(formatDayLabel(nearMidnightAmsterdam, "UTC"));
  });

  it("uses each studio's own configured timezone for the same instant", async () => {
    const repos = createInMemoryRepositories(seedWithTimezone("America/New_York"));
    const ctx = await getStudioContext(repos);

    const data = await getDashboard(repos, ctx, { now: () => nearMidnightAmsterdam });

    expect(data.todayLabel).toBe(formatDayLabel(nearMidnightAmsterdam, "America/New_York"));
    expect(data.todayLabel).toBe("Sunday 14 June");
  });

  it("derives the header label and the today-session filter from the same injected instant", async () => {
    const repos = createInMemoryRepositories(seedWithTimezone("Europe/Amsterdam"));
    const ctx = await getStudioContext(repos);

    const data = await getDashboard(repos, ctx, { now: () => nearMidnightAmsterdam });

    expect(Array.isArray(data.today)).toBe(true);
    expect(data.todayLabel).toBe(formatDayLabel(nearMidnightAmsterdam, ctx.studio.timezone));
  });
});
