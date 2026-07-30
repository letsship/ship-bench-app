import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the env module so the real-posthog path can be exercised without real
// Supabase/PostHog vars. Each test sets the desired clientEnv return value.
const clientEnvMock = vi.fn();
vi.mock("@/lib/env", () => ({ clientEnv: (...args: unknown[]) => clientEnvMock(...args) }));

import { __setTestTracker, resolveTracker } from "./tracker";
import { createFakeTracker } from "./fake-tracker";

describe("tracker composition root", () => {
  const originalFake = process.env.USE_FAKE_BACKENDS;

  beforeEach(() => {
    __setTestTracker(null);
    clientEnvMock.mockReset();
  });

  afterEach(() => {
    __setTestTracker(null);
    if (originalFake === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = originalFake;
  });

  it("returns an injected test tracker first (seam wins, even under fake backends)", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const injected = createFakeTracker();
    __setTestTracker(injected);
    expect(resolveTracker()).toBe(injected);
  });

  it("falls back to a shared fake tracker under USE_FAKE_BACKENDS=1", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    __setTestTracker(null);
    const a = resolveTracker();
    const b = resolveTracker();
    expect(a).toBe(b); // same shared instance across calls
  });

  it("resets the seam when __setTestTracker(null) is called", () => {
    const injected = createFakeTracker();
    __setTestTracker(injected);
    expect(resolveTracker()).toBe(injected);
    __setTestTracker(null);
    process.env.USE_FAKE_BACKENDS = "1";
    expect(resolveTracker()).not.toBe(injected);
  });

  it("throws on the real path when NEXT_PUBLIC_POSTHOG_KEY is unset", () => {
    process.env.USE_FAKE_BACKENDS = "0";
    __setTestTracker(null);
    clientEnvMock.mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k",
      NEXT_PUBLIC_SITE_URL: undefined,
      NEXT_PUBLIC_POSTHOG_KEY: undefined,
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    });
    expect(() => resolveTracker()).toThrow(/NEXT_PUBLIC_POSTHOG_KEY/);
  });

  it("builds the real PostHog tracker when the key is set", () => {
    process.env.USE_FAKE_BACKENDS = "0";
    __setTestTracker(null);
    clientEnvMock.mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k",
      NEXT_PUBLIC_SITE_URL: undefined,
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key",
      NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
    });
    const tracker = resolveTracker();
    expect(tracker).toBeDefined();
    expect(typeof tracker.capture).toBe("function");
  });
});

describe("fake tracker", () => {
  it("records captured events", async () => {
    const fake = createFakeTracker();
    await fake.capture({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "s1" },
    });
    expect(fake.captured).toHaveLength(1);
    expect(fake.captured[0]).toEqual({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "s1" },
    });
  });
});
