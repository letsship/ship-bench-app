import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("posthog-node", () => ({
  PostHog: vi.fn(() => ({ capture: vi.fn(), shutdown: vi.fn() })),
}));

describe("createAnalyticsTracker", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the fake tracker under USE_FAKE_BACKENDS=1", async () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const { createAnalyticsTracker } = await import("./tracker");
    const tracker = createAnalyticsTracker();
    await tracker.capture({ event: "booking_created", distinctId: "m1", properties: {} });
    expect((tracker as { captured: unknown[] }).captured).toHaveLength(1);
  });

  it("throws a descriptive error when the real path is selected without a project token", async () => {
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const { createAnalyticsTracker } = await import("./tracker");
    expect(() => createAnalyticsTracker()).toThrow(/NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/);
  });

  it("constructs the real tracker when a project token is set", async () => {
    delete process.env.USE_FAKE_BACKENDS;
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_x";
    const { createAnalyticsTracker } = await import("./tracker");
    expect(() => createAnalyticsTracker()).not.toThrow();
  });
});
