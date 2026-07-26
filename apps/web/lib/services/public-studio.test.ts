import { afterEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassSession, ClassType, Studio, StudioSettings } from "@/lib/db/types";
import { listPublicStudios, resolvePublicStudio } from "./public-studio";

const NOW = new Date();
const ISO = NOW.toISOString();
const PAST = new Date(NOW.getTime() - 86_400_000).toISOString();
const FUTURE = new Date(NOW.getTime() + 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 90_000_000).toISOString();

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

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
};

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Amara Okafor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

function seed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio,
    settings,
    members: [],
    classTypes: [classType],
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

describe("resolvePublicStudio", () => {
  it("returns the studio and only its future classes", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({
          sessions: [
            session("past", { startsAt: PAST, endsAt: PAST }),
            session("future", { startsAt: FUTURE, endsAt: FUTURE_END }),
          ],
        }),
      ),
    );

    const data = await resolvePublicStudio("riverbank-movement");

    expect(data?.studio.name).toBe("Riverbank Movement");
    expect(data?.classes).toHaveLength(1);
    expect(data?.classes[0]).toMatchObject({
      id: "future",
      name: "Vinyasa Flow",
      instructor: "Amara Okafor",
      startsAt: FUTURE,
    });
  });

  it("returns null for a slug that matches no studio", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    expect(await resolvePublicStudio("no-such-studio")).toBeNull();
  });
});

describe("listPublicStudios", () => {
  it("lists every provisioned studio", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));

    const studios = await listPublicStudios();
    expect(studios.map((row) => row.slug)).toEqual(["riverbank-movement"]);
  });
});
