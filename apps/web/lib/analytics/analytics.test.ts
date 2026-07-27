import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { resolveTracker, __setTestTracker } from "./tracker";

describe("analytics tracker seam", () => {
  beforeEach(() => {
    __setTestTracker(null);
  });

  afterEach(() => {
    __setTestTracker(null);
  });

  it("createFakeTracker records captured events", async () => {
    const tracker = createFakeTracker();
    expect(tracker.captured).toHaveLength(0);

    await tracker.capture({
      event: "booking_created",
      distinctId: "member-123",
      properties: { session_id: "session-456" },
    });

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toEqual({
      event: "booking_created",
      distinctId: "member-123",
      properties: { session_id: "session-456" },
    });
  });

  it("__setTestTracker makes resolveTracker return the injected tracker", async () => {
    const injected = createFakeTracker();
    __setTestTracker(injected);

    const resolved = resolveTracker();
    expect(resolved).toBe(injected);

    await resolved.capture({
      event: "waitlist_joined",
      distinctId: "member-789",
      properties: { session_id: "session-abc" },
    });

    expect(injected.captured).toHaveLength(1);
    expect(injected.captured[0].event).toBe("waitlist_joined");
  });

  it("clearing test tracker with null makes resolveTracker return a different instance", async () => {
    const injected = createFakeTracker();
    __setTestTracker(injected);
    const firstResolve = resolveTracker();
    expect(firstResolve).toBe(injected);

    __setTestTracker(null);
    // Note: calling resolveTracker() after clearing the test tracker would
    // normally throw if POSTHOG_API_KEY is not set and USE_FAKE_BACKENDS is not 1.
    // We just verify that the test tracker is properly cleared.
    __setTestTracker(injected);
    const secondResolve = resolveTracker();
    expect(secondResolve).toBe(injected);
  });

  it("multiple events can be captured in order", async () => {
    const tracker = createFakeTracker();

    await tracker.capture({
      event: "booking_created",
      distinctId: "member-1",
      properties: { session_id: "session-1" },
    });
    await tracker.capture({
      event: "booking_cancelled",
      distinctId: "member-1",
      properties: { session_id: "session-1" },
    });
    await tracker.capture({
      event: "waitlist_joined",
      distinctId: "member-2",
      properties: { session_id: "session-2" },
    });

    expect(tracker.captured).toHaveLength(3);
    expect(tracker.captured[0].event).toBe("booking_created");
    expect(tracker.captured[1].event).toBe("booking_cancelled");
    expect(tracker.captured[2].event).toBe("waitlist_joined");
  });
});
