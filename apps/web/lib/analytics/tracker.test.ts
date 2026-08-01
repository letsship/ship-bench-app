import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";
import type { AnalyticsEvent } from "./types";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

const event: AnalyticsEvent = {
  name: "booking_created",
  distinctId: "m1",
  properties: { session_id: "cs1" },
};

describe("fake tracker", () => {
  it("records captured events", async () => {
    const tracker = createFakeTracker();
    await tracker.capture(event);
    expect(tracker.name).toBe("fake");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toBe(event);
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

  it("maps an event onto the PostHog capture params and flushes immediately", async () => {
    const tracker = createPostHogTracker({ apiKey: "phc_k", host: "https://eu.i.posthog.com" });
    await tracker.capture(event);
    expect(PostHog).toHaveBeenCalledWith("phc_k", {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe("tracker seam", () => {
  afterEach(() => {
    __setTestTracker(null);
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.POSTHOG_API_KEY;
  });

  it("returns the injected tracker and reverts to the default after reset", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const injected = createFakeTracker();
    __setTestTracker(injected);
    expect(resolveTracker()).toBe(injected);
    __setTestTracker(null);
    const resolved = resolveTracker();
    expect(resolved).not.toBe(injected);
    expect(resolved.name).toBe("fake");
  });

  it("builds the PostHog tracker from env outside fake-backends mode", () => {
    process.env.POSTHOG_API_KEY = "phc_k";
    expect(resolveTracker().name).toBe("posthog");
  });

  it("surfaces a missing API key as an error", () => {
    expect(() => resolveTracker()).toThrow(/POSTHOG_API_KEY/);
  });
});
