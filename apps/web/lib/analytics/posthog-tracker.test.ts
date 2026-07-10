import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsCaptureEvent } from "./types";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

const event: AnalyticsCaptureEvent = {
  event: "booking_created",
  distinctId: "m1",
  properties: { session_id: "cs1" },
};

describe("posthog tracker", () => {
  const capture = vi.fn();
  const shutdown = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    capture.mockReset();
    shutdown.mockClear();
    vi.mocked(PostHog).mockImplementation(() => ({ capture, shutdown }) as unknown as PostHog);
  });

  it("maps a capture event onto the PostHog client and shuts down", async () => {
    const tracker = createPostHogTracker({
      projectToken: "phc_x",
      host: "https://us.i.posthog.com",
    });
    await tracker.capture(event);
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("constructs the client with flushAt/flushInterval set for short-lived functions", async () => {
    createPostHogTracker({ projectToken: "phc_x", host: "https://us.i.posthog.com" });
    expect(PostHog).toHaveBeenCalledWith("phc_x", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  });

  it("awaits shutdown after every capture", async () => {
    const tracker = createPostHogTracker({ projectToken: "phc_x" });
    await tracker.capture(event);
    await tracker.capture({ ...event, event: "booking_cancelled" });
    expect(shutdown).toHaveBeenCalledTimes(2);
  });
});
