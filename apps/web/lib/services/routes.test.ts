import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { __setTestTracker, resolveTracker } from "@/lib/analytics";
import { createRecordingTracker } from "@/lib/analytics/fake-tracker";
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

describe("analytics tracker injection via __setTestTracker seam", () => {
  beforeEach(() => {
    process.env.USE_FAKE_BACKENDS = "1";
  });

  afterEach(() => {
    __setTestTracker(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("__setTestTracker injects a tracker that resolveTracker returns", () => {
    const tracker = createRecordingTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
  });

  it("__setTestTracker(null) clears the injected tracker and falls back to recording tracker", () => {
    const tracker = createRecordingTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
    __setTestTracker(null);
    // After clearing, should get a different tracker (the fake-backends one)
    const resolver = resolveTracker();
    expect(resolver).not.toBe(tracker);
  });
});
