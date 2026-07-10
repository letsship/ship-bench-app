import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "./fake-provider";
import { createPostHogProvider } from "./posthog-provider";
import { createAnalyticsClient } from "./provider";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

describe("fake provider", () => {
  it("returns undefined for an unset flag and records captures", async () => {
    const provider = createFakeProvider();
    expect(await provider.getFlag("m1", "waitlist_experiment")).toBeUndefined();
    await provider.capture({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
    expect(provider.captured).toEqual([
      { distinctId: "m1", event: "waitlist_joined", properties: { sessionId: "cs1" } },
    ]);
  });

  it("returns a preset flag value scoped to distinct id + flag key", async () => {
    const provider = createFakeProvider();
    provider.setFlag("m1", "waitlist_experiment", "control");
    expect(await provider.getFlag("m1", "waitlist_experiment")).toBe("control");
    expect(await provider.getFlag("m2", "waitlist_experiment")).toBeUndefined();
  });
});

describe("posthog provider", () => {
  const evaluateFlags = vi.fn();
  const capture = vi.fn();
  const shutdown = vi.fn();

  beforeEach(() => {
    evaluateFlags.mockReset();
    capture.mockReset();
    shutdown.mockReset();
    vi.mocked(PostHog).mockImplementation(
      () => ({ evaluateFlags, capture, shutdown }) as unknown as PostHog,
    );
  });

  it("evaluates via evaluateFlags/getFlag (exposure-counting) and shuts down", async () => {
    const getFlag = vi.fn().mockReturnValue("control");
    evaluateFlags.mockResolvedValue({ getFlag });
    const provider = createPostHogProvider({ apiKey: "k", host: "https://h" });

    const value = await provider.getFlag("m1", "waitlist_experiment");

    expect(value).toBe("control");
    expect(PostHog).toHaveBeenCalledWith("k", { host: "https://h", flushAt: 1, flushInterval: 0 });
    expect(evaluateFlags).toHaveBeenCalledWith("m1");
    expect(getFlag).toHaveBeenCalledWith("waitlist_experiment");
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("forwards capture() calls and shuts down", async () => {
    const provider = createPostHogProvider({ apiKey: "k", host: "https://h" });

    await provider.capture({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });

    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});

describe("createAnalyticsClient factory", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.mocked(PostHog).mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the fake client when USE_FAKE_BACKENDS=1", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    process.env.POSTHOG_API_KEY = "k";
    expect(createAnalyticsClient().constructor.name).not.toBe("PostHog");
  });

  it("returns the fake client when POSTHOG_API_KEY is unset", () => {
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.POSTHOG_API_KEY;
    const client = createAnalyticsClient();
    expect(typeof client.getFlag).toBe("function");
    expect(PostHog).not.toHaveBeenCalled();
  });

  it("constructs the real posthog provider when a key is configured", async () => {
    delete process.env.USE_FAKE_BACKENDS;
    process.env.POSTHOG_API_KEY = "k";
    process.env.POSTHOG_HOST = "https://h";
    const evaluateFlags = vi
      .fn()
      .mockResolvedValue({ getFlag: vi.fn().mockReturnValue(undefined) });
    vi.mocked(PostHog).mockImplementation(
      () => ({ evaluateFlags, capture: vi.fn(), shutdown: vi.fn() }) as unknown as PostHog,
    );

    const client = createAnalyticsClient();
    await client.getFlag("m1", "waitlist_experiment");

    expect(PostHog).toHaveBeenCalledWith("k", { host: "https://h", flushAt: 1, flushInterval: 0 });
  });
});
