import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";
import { BOOKING_CREATED, type CaptureEvent } from "./types";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

const event: CaptureEvent = {
  event: BOOKING_CREATED,
  distinctId: "m1",
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

describe("tracker seam", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("resolves the injected test tracker when one is set", () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
  });

  it("falls back to default resolution once the test tracker is cleared", () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    __setTestTracker(null);
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    expect(resolveTracker()).not.toBe(tracker);
    vi.unstubAllEnvs();
  });

  it("throws rather than silently dropping events when PostHog is unconfigured", () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    expect(() => resolveTracker()).toThrow(/NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set/);
    vi.unstubAllEnvs();
  });
});

describe("posthog tracker", () => {
  const capture = vi.fn();
  const flush = vi.fn();

  beforeEach(() => {
    capture.mockReset();
    flush.mockReset().mockResolvedValue(undefined);
    vi.mocked(PostHog).mockImplementation(() => ({ capture, flush }) as unknown as PostHog);
  });

  it("constructs the client with batching disabled for short-lived requests", () => {
    createPostHogTracker({ token: "ph_token", host: "https://us.i.posthog.com" });
    expect(PostHog).toHaveBeenCalledWith("ph_token", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  });

  it("maps a capture event onto the PostHog client and flushes it", async () => {
    const tracker = createPostHogTracker({ token: "ph_token", host: "https://us.i.posthog.com" });
    await tracker.capture(event);
    expect(capture).toHaveBeenCalledWith({
      event: BOOKING_CREATED,
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
