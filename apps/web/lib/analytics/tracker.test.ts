import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostHog } from "posthog-node";
import { __setTestTracker, resolveTracker } from "./index";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { CaptureEvent } from "./types";

// The PostHog adapter is the only module that imports `posthog-node`. We mock
// the vendor package (hoisted ahead of the static import, exactly like
// `notifications/providers.test.ts` mocks `resend`) so this test never touches
// the network and the "no vendor import leaks past the adapter" guarantee is
// structurally enforced.
vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

describe("resolveTracker test seam", () => {
  beforeEach(() => {
    __setTestTracker(null);
  });

  it("returns the injected test tracker", () => {
    const fake = createFakeTracker();
    __setTestTracker(fake);
    expect(resolveTracker()).toBe(fake);
  });

  it("reverts to the non-test path after the test tracker is cleared", () => {
    const fake = createFakeTracker();
    __setTestTracker(fake);
    expect(resolveTracker()).toBe(fake);
    __setTestTracker(null);
    // Fake-backends mode is not enabled in the test env, and the token is not
    // set, so the real path throws — proving the seam no longer returns the
    // injected tracker.
    expect(() => resolveTracker()).toThrow(/NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/);
  });
});

describe("fake tracker", () => {
  it("records each captured event in order", () => {
    const fake = createFakeTracker();
    expect(fake.name).toBe("fake");
    const events: CaptureEvent[] = [
      { event: "booking_created", distinctId: "m1", properties: { session_id: "s1" } },
      { event: "waitlist_joined", distinctId: "m2", properties: { session_id: "s1" } },
      { event: "booking_cancelled", distinctId: "m1", properties: { session_id: "s1" } },
    ];
    for (const event of events) fake.capture(event);
    expect(fake.captured).toEqual(events);
  });
});

describe("posthog tracker adapter", () => {
  const capture = vi.fn();
  const flush = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    capture.mockReset();
    flush.mockReset();
    flush.mockResolvedValue(undefined);
    vi.mocked(PostHog).mockImplementation(
      () => ({ capture, flush }) as unknown as InstanceType<typeof PostHog>,
    );
  });

  it("maps a CaptureEvent onto the PostHog client and flushes eagerly", async () => {
    const tracker = createPostHogTracker({ token: "tk", host: "https://us.i.posthog.com" });
    expect(tracker.name).toBe("posthog");
    expect(PostHog).toHaveBeenCalledWith("tk", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });

    await tracker.capture({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "s1" },
    });

    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "s1" },
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("defaults properties to an empty object when none are provided", async () => {
    const tracker = createPostHogTracker({ token: "tk" });
    await tracker.capture({ event: "booking_cancelled", distinctId: "m1" });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_cancelled",
      properties: {},
    });
  });
});
