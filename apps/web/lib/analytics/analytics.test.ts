import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./index";
import { createPostHogTracker } from "./posthog-tracker";
import type { TrackedEvent } from "./types";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

const event: TrackedEvent = {
  event: "booking_created",
  distinctId: "m1",
  properties: { session_id: "cs1" },
};

describe("fake tracker", () => {
  it("records captured events", async () => {
    const tracker = createFakeTracker();
    expect(tracker.name).toBe("fake");
    await tracker.capture(event);
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toBe(event);
  });
});

describe("posthog tracker", () => {
  const capture = vi.fn();
  const shutdown = vi.fn();

  beforeEach(() => {
    capture.mockReset();
    shutdown.mockReset();
    vi.mocked(PostHog).mockImplementation(
      () => ({ capture, shutdown }) as unknown as PostHog,
    );
  });

  it("maps a TrackedEvent onto posthog capture args", async () => {
    shutdown.mockResolvedValue(undefined);
    const tracker = createPostHogTracker({ token: "phk", host: "https://h" });
    await tracker.capture(event);
    expect(tracker.name).toBe("posthog");
    expect(PostHog).toHaveBeenCalledWith("phk", {
      host: "https://h",
      flushAt: 1,
      flushInterval: 0,
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("awaits shutdown so events flush before the request context ends", async () => {
    let resolved = false;
    shutdown.mockImplementation(() => {
      resolved = true;
      return Promise.resolve();
    });
    const tracker = createPostHogTracker({ token: "phk" });
    await tracker.capture(event);
    expect(resolved).toBe(true);
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("defaults host to undefined when not provided", async () => {
    shutdown.mockResolvedValue(undefined);
    const tracker = createPostHogTracker({ token: "phk" });
    await tracker.capture(event);
    expect(PostHog).toHaveBeenCalledWith("phk", {
      host: undefined,
      flushAt: 1,
      flushInterval: 0,
    });
  });
});

describe("tracker composition root", () => {
  const prevKey = process.env.POSTHOG_API_KEY;
  const prevHost = process.env.POSTHOG_HOST;

  beforeEach(() => {
    process.env.POSTHOG_API_KEY = "phk_test";
    process.env.POSTHOG_HOST = "https://h";
  });
  afterEach(() => {
    __setTestTracker(null);
    if (prevKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = prevKey;
    if (prevHost === undefined) delete process.env.POSTHOG_HOST;
    else process.env.POSTHOG_HOST = prevHost;
  });

  it("__setTestTracker overrides the resolved tracker", () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
  });

  it("__setTestTracker(null) clears the override", () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);
    expect(resolveTracker()).toBe(tracker);
    __setTestTracker(null);
    const resolved = resolveTracker();
    expect(resolved).not.toBe(tracker);
    expect(resolved.name).toBe("posthog");
  });
});
