import { afterEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Studio, StudioSettings } from "@/lib/db/types";
import sitemap from "./sitemap";

const ISO = new Date().toISOString();

const studio: Studio = {
  id: "s1",
  name: "Riverbank Movement",
  slug: "riverbank-movement",
  timezone: "Europe/Amsterdam",
  createdAt: ISO,
};

const settings: StudioSettings = {
  studioId: "s1",
  currency: "EUR",
  taxRateBps: 900,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
};

function seed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio,
    settings,
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

afterEach(() => {
  __setTestRepositories(null);
});

describe("sitemap", () => {
  it("lists an absolute URL for the public studio page", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(`http://localhost:3000/s/${studio.slug}`);
    expect(urls.every((url) => url.startsWith("http"))).toBe(true);
  });

  it("does not list any auth-gated route", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => /\/(members|classes|invoices|settings)(\/|$)/.test(url))).toBe(false);
  });
});
