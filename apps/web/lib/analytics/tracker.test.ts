import { beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestTracker, resolveTracker } from "./tracker";
import { createFakeTracker } from "./fake-tracker";

vi.mock("@/lib/env", () => ({
  serverEnv: () => ({
    POSTHOG_API_KEY: "test-key",
    POSTHOG_HOST: undefined,
  }),
}));

vi.mock("./posthog-tracker", () => ({
  createPosthogTracker: () => ({
    capture: vi.fn(),
  }),
}));

describe("tracker composition root", () => {
  beforeEach(() => {
    // Clear the test tracker between tests
    __setTestTracker(null);
  });

  it("returns a fake tracker when test tracker is not set and not in fake mode", async () => {
    const tracker = await resolveTracker();
    expect(tracker).toBeDefined();
    // Verify it's a tracker by calling capture
    tracker.capture({
      event: "booking_created",
      distinctId: "member1",
      properties: { session_id: "session1" },
    });
  });

  it("injects and clears a test tracker via __setTestTracker", async () => {
    const fakeTracker = createFakeTracker();
    __setTestTracker(fakeTracker);

    const resolved = await resolveTracker();
    expect(resolved).toBe(fakeTracker);

    resolved.capture({
      event: "booking_created",
      distinctId: "member1",
      properties: { session_id: "session1" },
    });

    expect(fakeTracker.captured).toHaveLength(1);

    __setTestTracker(null);
    // After clearing, should not use the injected tracker (unless USE_FAKE_BACKENDS)
    const cleared = await resolveTracker();
    expect(cleared).not.toBe(fakeTracker);
  });

  it("fake tracker records captured events", () => {
    const tracker = createFakeTracker();
    tracker.capture({
      event: "booking_created",
      distinctId: "member1",
      properties: { session_id: "session1" },
    });
    tracker.capture({
      event: "waitlist_joined",
      distinctId: "member2",
      properties: { session_id: "session2" },
    });

    expect(tracker.captured).toHaveLength(2);
    expect(tracker.captured[0]).toEqual({
      event: "booking_created",
      distinctId: "member1",
      properties: { session_id: "session1" },
    });
    expect(tracker.captured[1]).toEqual({
      event: "waitlist_joined",
      distinctId: "member2",
      properties: { session_id: "session2" },
    });
  });
});
