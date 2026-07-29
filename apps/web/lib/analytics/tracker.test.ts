import { afterEach, describe, expect, it } from "vitest";
import { __setTestTracker, createTracker } from "@/lib/analytics/tracker";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";

const originalFakeBackends = process.env.USE_FAKE_BACKENDS;

afterEach(() => {
  __setTestTracker(null);
  if (originalFakeBackends === undefined) delete process.env.USE_FAKE_BACKENDS;
  else process.env.USE_FAKE_BACKENDS = originalFakeBackends;
});

describe("tracker composition root", () => {
  it("resolveTracker honours a tracker injected via __setTestTracker", async () => {
    const { resolveTracker } = await import("@/lib/analytics/tracker");
    const fake = createFakeTracker();
    __setTestTracker(fake);
    expect(resolveTracker()).toBe(fake);
  });

  it("clears the injected tracker when passed null", async () => {
    const { resolveTracker } = await import("@/lib/analytics/tracker");
    const fake = createFakeTracker();
    __setTestTracker(fake);
    expect(resolveTracker()).toBe(fake);
    __setTestTracker(null);
    // After clearing, resolveTracker falls through to createTracker(), which in
    // fake-backends mode is the shared fake — never the injected instance.
    process.env.USE_FAKE_BACKENDS = "1";
    expect(resolveTracker()).not.toBe(fake);
  });

  it("createTracker returns the fake tracker in USE_FAKE_BACKENDS=1 mode", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const tracker = createTracker();
    expect(tracker.name).toBe("fake");
  });
});
