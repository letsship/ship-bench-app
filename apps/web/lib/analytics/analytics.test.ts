import { describe, expect, it, afterEach } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { resolveTracker, __setTestTracker } from "./provider";

describe("analytics module", () => {
  afterEach(() => {
    __setTestTracker(null);
  });

  describe("fake tracker", () => {
    it("records captured events", async () => {
      const tracker = createFakeTracker();
      await tracker.capture({
        distinctId: "member-1",
        event: "booking_created",
        properties: { session_id: "session-1" },
      });
      await tracker.capture({
        distinctId: "member-2",
        event: "waitlist_joined",
        properties: { session_id: "session-2" },
      });
      expect(tracker.captured).toHaveLength(2);
      expect(tracker.captured[0]).toEqual({
        distinctId: "member-1",
        event: "booking_created",
        properties: { session_id: "session-1" },
      });
      expect(tracker.captured[1]).toEqual({
        distinctId: "member-2",
        event: "waitlist_joined",
        properties: { session_id: "session-2" },
      });
    });
  });

  describe("test tracker seam", () => {
    it("resolveTracker returns injected test tracker when set", () => {
      const fakeTracker = createFakeTracker();
      __setTestTracker(fakeTracker);
      const resolved = resolveTracker();
      expect(resolved).toBe(fakeTracker);
    });

    it("resolveTracker returns createTracker when test tracker is not set and USE_FAKE_BACKENDS is enabled", () => {
      __setTestTracker(null);
      process.env.USE_FAKE_BACKENDS = "1";
      try {
        const resolved = resolveTracker();
        expect(resolved).toBeDefined();
      } finally {
        delete process.env.USE_FAKE_BACKENDS;
      }
    });

    it("__setTestTracker(null) clears the injected tracker", () => {
      const fakeTracker = createFakeTracker();
      __setTestTracker(fakeTracker);
      __setTestTracker(null);
      process.env.USE_FAKE_BACKENDS = "1";
      try {
        const resolved = resolveTracker();
        expect(resolved).not.toBe(fakeTracker);
      } finally {
        delete process.env.USE_FAKE_BACKENDS;
      }
    });
  });
});
