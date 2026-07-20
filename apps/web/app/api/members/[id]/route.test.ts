import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { __setTestRepositories } from "@/lib/db/repos";
import type { Member } from "@/lib/db/types";
import { GET } from "./route";

const NOW = new Date();
const ISO = NOW.toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "Test Studio", slug: "test", timezone: "UTC", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "USD",
      taxRateBps: 0,
      cancellationWindowHours: 24,
      waitlistEnabled: false,
      notifyBookingConfirmations: false,
      notifyCancellations: false,
      notifyWaitlistPromotions: false,
      notifyInvoices: false,
    },
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

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: "Test Member",
  email: `member-${id}@example.com`,
  phone: "+1234567890",
  timezone: "UTC",
  createdAt: ISO,
  ...over,
});

describe("GET /api/members/[id]", () => {
  beforeEach(() => {
    __setTestRepositories(null);
  });

  it("should await async params and return the member", async () => {
    const testMember = member("m1", { name: "Alice" });
    const repos = createInMemoryRepositories(baseSeed({ members: [testMember] }));
    __setTestRepositories(repos);

    const request = new Request("http://localhost/api/members/m1");
    const params = Promise.resolve({ id: "m1" });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("id", "m1");
    expect(body).toHaveProperty("name", "Alice");
  });

  it("should handle Promise-wrapped params correctly", async () => {
    const testMember = member("m2", { name: "Bob" });
    const repos = createInMemoryRepositories(baseSeed({ members: [testMember] }));
    __setTestRepositories(repos);

    const request = new Request("http://localhost/api/members/m2");
    const params = new Promise<{ id: string }>((resolve) => {
      // Simulate async resolution
      resolve({ id: "m2" });
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("id", "m2");
    expect(body).toHaveProperty("name", "Bob");
  });
});
