import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("posthog-node", () => ({
  PostHog: vi.fn(() => {
    throw new Error("the real PostHog client must never be constructed on the fake path");
  }),
}));

describe("analytics tracker composition root", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("__setTestTracker makes resolveTracker return the injected recording tracker", async () => {
    const { __setTestTracker, resolveTracker } = await import("./tracker");
    const { createFakeTracker } = await import("./fake-tracker");
    const injected = createFakeTracker();
    __setTestTracker(injected);
    expect(resolveTracker()).toBe(injected);
    __setTestTracker(null);
  });

  it("createFakeTracker records capture() calls", async () => {
    const { createFakeTracker } = await import("./fake-tracker");
    const tracker = createFakeTracker();
    await tracker.capture({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
    expect(tracker.captured).toEqual([
      { event: "booking_created", distinctId: "m1", properties: { session_id: "cs1" } },
    ]);
  });

  it("the fake-backends path never constructs the real PostHog client", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    const { resolveTracker } = await import("./tracker");
    expect(() => resolveTracker()).not.toThrow();
  });
});
