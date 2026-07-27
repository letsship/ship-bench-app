import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestTracker, resolveTracker } from "./index";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { CaptureEvent } from "./types";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

const event: CaptureEvent = {
  event: "booking_created",
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

describe("posthog tracker", () => {
  const captureImmediate = vi.fn();

  beforeEach(() => {
    captureImmediate.mockReset();
    vi.mocked(PostHog).mockImplementation(() => ({ captureImmediate }) as unknown as PostHog);
  });

  it("maps a capture call onto PostHog's captureImmediate", async () => {
    captureImmediate.mockResolvedValue(undefined);
    const tracker = createPostHogTracker({ apiKey: "k", host: "https://us.i.posthog.com" });
    await tracker.capture(event);
    expect(captureImmediate).toHaveBeenCalledWith({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
  });
});

describe("tracker seam", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  it("returns the injected test tracker when set", () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
  });

  it("falls back to a fake tracker (never throws) when no key is configured", () => {
    const original = process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_API_KEY;
    expect(() => resolveTracker()).not.toThrow();
    const tracker = resolveTracker();
    expect(tracker).toHaveProperty("capture");
    if (original !== undefined) process.env.POSTHOG_API_KEY = original;
  });
});
