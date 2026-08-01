import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPostHogTracker } from "./posthog-tracker";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

describe("PostHog tracker", () => {
  const capture = vi.fn();
  const shutdown = vi.fn();

  beforeEach(() => {
    capture.mockReset();
    shutdown.mockReset();
    shutdown.mockResolvedValue(undefined);
    vi.mocked(PostHog).mockImplementation(() => ({ capture, shutdown }) as unknown as PostHog);
  });

  it("delivers each capture before a short-lived request completes", async () => {
    const tracker = createPostHogTracker({ apiKey: "key", host: "https://analytics.example" });

    await tracker.capture({
      event: "booking_created",
      distinctId: "member_1",
      properties: { session_id: "session_1" },
    });

    expect(PostHog).toHaveBeenCalledWith("key", {
      host: "https://analytics.example",
      flushAt: 1,
      flushInterval: 0,
    });
    expect(capture).toHaveBeenCalledWith({
      event: "booking_created",
      distinctId: "member_1",
      properties: { session_id: "session_1" },
    });
    expect(shutdown).toHaveBeenCalledOnce();
  });
});
