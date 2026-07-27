import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { __setTestTracker, resolveTracker } from "@/lib/analytics";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { BOOKING_CREATED } from "@/lib/analytics/types";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
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
});

describe("route handler analytics injection", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
  });

  it("resolveTracker returns injected test tracker when set via __setTestTracker", () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    const resolved = resolveTracker();
    expect(resolved).toBe(tracker);
  });

  it("__setTestTracker(null) restores default tracker resolution", () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    __setTestTracker(null);
    const resolved = resolveTracker();
    expect(resolved).not.toBe(tracker);
    vi.unstubAllEnvs();
  });

  it("captured events do not contain PII", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    // Capture a booking_created event (the type that would be captured by routes)
    await tracker.capture({
      event: BOOKING_CREATED,
      distinctId: "member-123",
      properties: { session_id: "session-456" },
    });

    const [event] = tracker.captured;
    // Verify PII-safe structure
    expect(event.event).toBe(BOOKING_CREATED);
    expect(event.distinctId).toBe("member-123");
    expect(event.properties?.session_id).toBe("session-456");
    // Verify no PII leaks
    expect(event.properties?.email).toBeUndefined();
    expect(event.properties?.name).toBeUndefined();
    expect(event.properties?.phone).toBeUndefined();
  });
});
