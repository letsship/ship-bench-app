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
    expect(tracker.name).toBe("fake");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toBe(event);
  });

  it("close() is a no-op", async () => {
    const tracker = createFakeTracker();
    await expect(tracker.close()).resolves.toBeUndefined();
  });
});

describe("posthog tracker", () => {
  const capture = vi.fn();
  const shutdown = vi.fn();

  beforeEach(() => {
    capture.mockReset();
    shutdown.mockReset();
    vi.mocked(PostHog).mockImplementation(() => ({ capture, shutdown }) as unknown as PostHog);
  });

  it("maps an event onto the PostHog capture params", async () => {
    const tracker = createPostHogTracker({ apiKey: "k", host: "https://us.i.posthog.com" });
    await tracker.capture(event);
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
    expect(shutdown).not.toHaveBeenCalled();
  });

  it("does not shut down the shared client between captures, only on close()", async () => {
    const tracker = createPostHogTracker({ apiKey: "k", host: "https://us.i.posthog.com" });
    await tracker.capture({ ...event, event: "booking_cancelled" });
    await tracker.capture({ ...event, event: "booking_created", distinctId: "m2" });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(shutdown).not.toHaveBeenCalled();
    await tracker.close();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("constructs the client with immediate-flush config", async () => {
    createPostHogTracker({ apiKey: "k", host: "https://us.i.posthog.com" });
    expect(PostHog).toHaveBeenCalledWith("k", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  });
});
