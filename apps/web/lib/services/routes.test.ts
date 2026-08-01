import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { POST as bookingPost } from "@/app/api/bookings/route";
import { DELETE as bookingDeleteById } from "@/app/api/bookings/[id]/route";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { ClassSession } from "@/lib/db/types";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ email: "tester@example.com" })),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    process.env.USE_FAKE_BACKENDS = "1";
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });

  it("POST and DELETE booking handlers capture funnel events through the tracker seam", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    const repos = createInMemoryRepositories(buildSeed(new Date()));
    __setTestRepositories(repos);
    const member = (await repos.members.listByStudio("00000000-0000-4000-8000-000000000001"))[0];
    const sessions = await repos.classSessions.listByStudio(member.studioId);
    let session: ClassSession | null = null;
    for (const candidate of sessions) {
      if (new Date(candidate.startsAt) <= new Date()) continue;
      const bookings = await repos.bookings.listBySession(candidate.id);
      if (!bookings.some((booking) => booking.memberId === member.id)) {
        session = candidate;
        break;
      }
    }
    if (!session) throw new Error("No unbooked seeded session available");

    const postResponse = await bookingPost(
      new Request("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.id, memberId: member.id }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(postResponse.status).toBe(201);
    const { bookingId } = (await postResponse.json()) as { bookingId: string };
    expect(tracker.captured).toEqual([
      { event: "booking_created", distinctId: member.id, properties: { session_id: session.id } },
    ]);

    const deleteResponse = await bookingDeleteById(new Request("http://localhost"), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(deleteResponse.status).toBe(200);
    expect(tracker.captured).toEqual([
      { event: "booking_created", distinctId: member.id, properties: { session_id: session.id } },
      { event: "booking_cancelled", distinctId: member.id, properties: { session_id: session.id } },
    ]);
  });
});
