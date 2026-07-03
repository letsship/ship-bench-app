import { newId } from "@/lib/db/ids";
import { classSessions, classTypes, members, studioSettings, studios } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { createMailjayProvider } from "@/lib/notifications/mailjay-provider";
import { createInMemoryTransport, type InMemoryTransport } from "@/lib/notifications/mailjay-sdk";
import type { NotificationProvider } from "@/lib/notifications/types";

// Shared, non-test fixtures for the service/route integration tests.

export function testProvider(): { provider: NotificationProvider; transport: InMemoryTransport } {
  const transport = createInMemoryTransport();
  return {
    provider: createMailjayProvider({ apiKey: "test-key", from: "hello@studio.co", transport }),
    transport,
  };
}

export interface Scenario {
  studioId: string;
  classTypeId: string;
  sessionId: string;
  memberA: string;
  memberB: string;
  memberC: string;
}

export interface ScenarioOptions {
  capacity?: number;
  waitlistEnabled?: boolean;
  cancellationWindowHours?: number;
  startsInHours?: number;
  taxRateBps?: number;
}

const HOUR_MS = 3_600_000;

// Insert one studio (UTC) with settings, a class type, a single session, and
// three active members. Times are relative to now so booking rules resolve.
export async function setupScenario(db: Db, options: ScenarioOptions = {}): Promise<Scenario> {
  const capacity = options.capacity ?? 10;
  const startHours = options.startsInHours ?? 48;
  const studioId = newId("stu");
  const classTypeId = newId("ct");
  const sessionId = newId("cs");
  const memberA = newId("mem");
  const memberB = newId("mem");
  const memberC = newId("mem");

  await db.insert(studios).values({ id: studioId, name: "Test Studio", slug: "test", timezone: "UTC" });
  await db.insert(studioSettings).values({
    studioId,
    currency: "EUR",
    taxRateBps: options.taxRateBps ?? 900,
    cancellationWindowHours: options.cancellationWindowHours ?? 12,
    waitlistEnabled: options.waitlistEnabled ?? true,
    notifyBookingConfirmations: true,
    notifyCancellations: true,
    notifyWaitlistPromotions: true,
    notifyInvoices: true,
  });
  await db.insert(classTypes).values({
    id: classTypeId,
    studioId,
    name: "Vinyasa Flow",
    color: "#5b8c5a",
    defaultCapacity: capacity,
    defaultPriceCents: 1800,
  });
  await db.insert(classSessions).values({
    id: sessionId,
    studioId,
    classTypeId,
    instructor: "Noor",
    startsAt: new Date(Date.now() + startHours * HOUR_MS).toISOString(),
    endsAt: new Date(Date.now() + (startHours + 1) * HOUR_MS).toISOString(),
    capacity,
    priceCents: 1800,
    status: "scheduled",
  });
  await db.insert(members).values([
    { id: memberA, studioId, name: "Alice", email: "alice@example.com", status: "active" },
    { id: memberB, studioId, name: "Bob", email: "bob@example.com", status: "active" },
    { id: memberC, studioId, name: "Cara", email: "cara@example.com", status: "active" },
  ]);

  return { studioId, classTypeId, sessionId, memberA, memberB, memberC };
}
