import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";
import { BOOKING_CREATED } from "./types";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

afterEach(() => {
  __setTestTracker(null);
  vi.unstubAllEnvs();
});

describe("fake tracker", () => {
  it("records captured events", async () => {
    const tracker = createFakeTracker();
    await tracker.capture({
      distinctId: "m1",
      event: BOOKING_CREATED,
      properties: { session_id: "cs1" },
    });
    expect(tracker.name).toBe("fake");
    expect(tracker.captured).toEqual([
      { distinctId: "m1", event: "booking_created", properties: { session_id: "cs1" } },
    ]);
  });
});

describe("posthog tracker", () => {
  const capture = vi.fn();
  const flush = vi.fn();

  beforeEach(() => {
    capture.mockReset();
    flush.mockReset().mockResolvedValue(undefined);
    vi.mocked(PostHog).mockImplementation(() => ({ capture, flush }) as unknown as PostHog);
  });

  it("forwards a capture to the client and flushes immediately", async () => {
    const tracker = createPostHogTracker({ apiKey: "phc_k", host: "https://eu.i.posthog.com" });
    await tracker.capture({
      distinctId: "m1",
      event: BOOKING_CREATED,
      properties: { session_id: "cs1" },
    });
    expect(PostHog).toHaveBeenCalledWith("phc_k", {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    expect(capture).toHaveBeenCalledExactlyOnceWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe("resolveTracker (composition root seam)", () => {
  it("prefers an injected test tracker over everything else", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    const injected = createFakeTracker();
    __setTestTracker(injected);
    expect(await resolveTracker()).toBe(injected);
  });

  it("uses the fake tracker under USE_FAKE_BACKENDS=1", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    expect((await resolveTracker()).name).toBe("fake");
  });

  it("throws without a PostHog token outside fake mode", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    await expect(resolveTracker()).rejects.toThrow(/NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/);
  });

  it("constructs the PostHog tracker when a token is set", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_token");
    expect((await resolveTracker()).name).toBe("posthog");
  });
});
