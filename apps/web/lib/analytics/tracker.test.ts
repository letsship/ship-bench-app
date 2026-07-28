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
    tracker.capture(event);
    expect(tracker.name).toBe("fake");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toBe(event);
  });

  it("records multiple events in order", async () => {
    const tracker = createFakeTracker();
    const e2: AnalyticsEvent = { event: "booking_cancelled", distinctId: "m2" };
    tracker.capture(event);
    tracker.capture(e2);
    expect(tracker.captured).toHaveLength(2);
    expect(tracker.captured[0].event).toBe("booking_created");
    expect(tracker.captured[1].event).toBe("booking_cancelled");
  });
});

describe("posthog tracker", () => {
  const capture = vi.fn();
  const shutdown = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    capture.mockReset();
    shutdown.mockReset().mockResolvedValue(undefined);
    vi.mocked(PostHog).mockImplementation(
      () => ({ capture, shutdown }) as unknown as PostHog,
    );
  });

  it("maps a capture onto the PostHog client", async () => {
    const tracker = createPosthogTracker({ apiKey: "phc_key", host: "https://us.i.posthog.com" });
    await tracker.capture(event);
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
    expect(shutdown).toHaveBeenCalled();
  });

  it("captures without properties", async () => {
    const tracker = createPosthogTracker({ apiKey: "k" });
    await tracker.capture({ event: "booking_cancelled", distinctId: "m2" });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m2",
      event: "booking_cancelled",
      properties: undefined,
    });
  });

  it("reports the provider name", () => {
    const tracker = createPosthogTracker({ apiKey: "k" });
    expect(tracker.name).toBe("posthog");
  });
});