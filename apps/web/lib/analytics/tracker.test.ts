import { beforeEach, describe, expect, it } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker, createTracker } from "./tracker";

describe("analytics tracker composition root", () => {
  beforeEach(() => {
    __setTestTracker(null);
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

  it("returns the injected test tracker when set", () => {
    const fakeTracker = createFakeTracker();
    __setTestTracker(fakeTracker);
    const tracker = createTracker();
    expect(tracker).toBe(fakeTracker);
  });

  it("returns a fake tracker when USE_FAKE_BACKENDS=1", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const tracker = createTracker();
    expect(tracker).toBeDefined();
    // Verify it has the capture method
    expect(typeof tracker.capture).toBe("function");
  });

  it("clears the test tracker when set to null", () => {
    const fakeTracker = createFakeTracker();
    __setTestTracker(fakeTracker);
    __setTestTracker(null);
    process.env.USE_FAKE_BACKENDS = "1";
    const tracker = createTracker();
    // Should return a new fake tracker, not the originally injected one
    expect(tracker).not.toBe(fakeTracker);
  });

  it("throws when token is missing in production mode", () => {
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
    expect(() => createTracker()).toThrow("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set");
  });

  it("throws when host is missing in production mode", () => {
    delete process.env.USE_FAKE_BACKENDS;
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    expect(() => createTracker()).toThrow("NEXT_PUBLIC_POSTHOG_HOST is not set");
  });
});
