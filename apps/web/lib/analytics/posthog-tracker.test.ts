import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPosthogTracker } from "./posthog-tracker";
import type { AnalyticsEvent } from "./types";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

const event: AnalyticsEvent = {
  distinctId: "m1",
  event: "booking_created",
  properties: { session_id: "cs1" },
};

describe("posthog tracker", () => {
  const capture = vi.fn();
  const shutdown = vi.fn();

  beforeEach(() => {
    capture.mockReset();
    shutdown.mockReset();
    vi.mocked(PostHog).mockImplementation(() => ({ capture, shutdown }) as unknown as PostHog);
  });

  it("maps an event onto the posthog-node capture call and flushes", async () => {
    const tracker = createPosthogTracker({ apiKey: "k", host: "https://us.i.posthog.com" });
    await tracker.capture(event);
    expect(PostHog).toHaveBeenCalledWith("k", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
    expect(shutdown).toHaveBeenCalled();
  });
});
