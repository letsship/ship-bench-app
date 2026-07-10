import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { createAnalyticsTracker } from "./tracker";
import type { AnalyticsEvent } from "./types";

const event: AnalyticsEvent = {
  distinctId: "m1",
  event: "booking_created",
  properties: { session_id: "cs1" },
};

describe("fake tracker", () => {
  it("records captured events", async () => {
    const tracker = createFakeTracker();
    await tracker.capture(event);
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toBe(event);
  });
});

describe("createAnalyticsTracker", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a fake tracker when USE_FAKE_BACKENDS=1", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    vi.stubEnv("POSTHOG_API_KEY", "");
    const tracker = createAnalyticsTracker();
    await tracker.capture(event);
    expect((tracker as ReturnType<typeof createFakeTracker>).captured).toHaveLength(1);
  });

  it("throws when POSTHOG_API_KEY is unset in real mode", () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "0");
    vi.stubEnv("POSTHOG_API_KEY", "");
    expect(() => createAnalyticsTracker()).toThrow(/POSTHOG_API_KEY/);
  });
});
