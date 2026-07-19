import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { __setTestTracker, resolveTracker } from "./tracker";
import { createFakeTracker } from "./fake-tracker";

describe("tracker composition root", () => {
  beforeEach(() => {
    process.env.USE_FAKE_BACKENDS = "1";
  });

  afterEach(() => {
    __setTestTracker(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("returns injected test tracker when set", () => {
    const testTracker = createFakeTracker();
    __setTestTracker(testTracker);
    const resolved = resolveTracker();
    expect(resolved).toBe(testTracker);
  });

  it("clears injected tracker when set to null", () => {
    const testTracker = createFakeTracker();
    __setTestTracker(testTracker);
    __setTestTracker(null);
    // After clearing, should return a fake tracker (when USE_FAKE_BACKENDS is enabled)
    const resolved = resolveTracker();
    expect(resolved).not.toBe(testTracker);
  });
});
