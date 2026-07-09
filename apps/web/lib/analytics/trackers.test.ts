import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { createPosthogTracker } from "./posthog-tracker";
import type { AnalyticsEvent } from "./types";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

const event: AnalyticsEvent = {
  event: "booking_created",
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
  const captureImmediate = vi.fn();

  beforeEach(() => {
    captureImmediate.mockReset();
    vi.mocked(PostHog).mockImplementation(() => ({ captureImmediate }) as unknown as PostHog);
  });

  it("maps an event onto the PostHog captureImmediate params", async () => {
    captureImmediate.mockResolvedValue(undefined);
    const tracker = createPosthogTracker({ apiKey: "k" });
    expect(tracker.name).toBe("posthog");
    await tracker.capture(event);
    expect(captureImmediate).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
  });

  it("constructs the client with the configured host", async () => {
    captureImmediate.mockResolvedValue(undefined);
    createPosthogTracker({ apiKey: "k", host: "https://eu.i.posthog.com" });
    expect(PostHog).toHaveBeenCalledWith("k", { host: "https://eu.i.posthog.com" });
  });
});
