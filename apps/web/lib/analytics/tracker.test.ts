import { afterEach, describe, expect, it } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";

const originalFakeBackends = process.env.USE_FAKE_BACKENDS;

afterEach(() => {
  __setTestTracker(null);
  process.env.USE_FAKE_BACKENDS = originalFakeBackends;
});

describe("tracker composition root", () => {
  it("resolves an injected test tracker and clears the seam", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const tracker = createFakeTracker();

    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);

    __setTestTracker(null);
    expect(resolveTracker()).not.toBe(tracker);
  });
});
