import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
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
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toBe(event);
  });
});

describe("posthog tracker", () => {
  const capture = vi.fn();

  beforeEach(() => {
    capture.mockReset();
    vi.mocked(PostHog).mockImplementation(() => ({ capture }) as unknown as PostHog);
  });

  it("maps an event onto the PostHog client's capture params", async () => {
    const tracker = createPostHogTracker({ apiKey: "k", host: "https://us.i.posthog.com" });
    await tracker.capture(event);
    expect(PostHog).toHaveBeenCalledWith("k", { host: "https://us.i.posthog.com" });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
  });
});
