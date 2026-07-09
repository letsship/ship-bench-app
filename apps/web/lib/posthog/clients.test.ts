import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "./fake-client";
import { createPostHogNodeClient } from "./posthog-client";
import { createPostHogClient } from "./provider";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

describe("fake client", () => {
  it("records captured events and defaults unset flags to a non-control value", async () => {
    const client = createFakeClient();
    expect(client.name).toBe("fake");
    await expect(client.getFeatureFlag("waitlist_experiment", "m1")).resolves.toBe(true);

    await client.capture({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
    expect(client.captured).toHaveLength(1);
    expect(client.captured[0]).toEqual({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
  });

  it("returns a preset flag value", async () => {
    const client = createFakeClient();
    client.setFlag("waitlist_experiment", "control");
    await expect(client.getFeatureFlag("waitlist_experiment", "m1")).resolves.toBe("control");
  });
});

describe("posthog-node client", () => {
  const getFeatureFlag = vi.fn();
  const captureImmediate = vi.fn();

  beforeEach(() => {
    getFeatureFlag.mockReset();
    captureImmediate.mockReset();
    vi.mocked(PostHog).mockImplementation(
      () => ({ getFeatureFlag, captureImmediate }) as unknown as PostHog,
    );
  });

  it("maps getFeatureFlag onto the SDK call", async () => {
    getFeatureFlag.mockResolvedValue("control");
    const client = createPostHogNodeClient({ apiKey: "k", host: "https://h" });
    await expect(client.getFeatureFlag("waitlist_experiment", "m1")).resolves.toBe("control");
    expect(getFeatureFlag).toHaveBeenCalledWith("waitlist_experiment", "m1");
  });

  it("fails open to undefined when the SDK call rejects", async () => {
    getFeatureFlag.mockRejectedValue(new Error("network down"));
    const client = createPostHogNodeClient({ apiKey: "k", host: "https://h" });
    await expect(client.getFeatureFlag("waitlist_experiment", "m1")).resolves.toBeUndefined();
  });

  it("maps capture onto captureImmediate", async () => {
    captureImmediate.mockResolvedValue(undefined);
    const client = createPostHogNodeClient({ apiKey: "k", host: "https://h" });
    await client.capture({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
    expect(captureImmediate).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
  });
});

describe("createPostHogClient", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the fake client when USE_FAKE_BACKENDS=1", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    process.env.POSTHOG_API_KEY = "phc_x";
    expect(createPostHogClient().name).toBe("fake");
  });

  it("returns the fake client when no API key is configured", () => {
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.POSTHOG_API_KEY;
    expect(createPostHogClient().name).toBe("fake");
  });

  it("returns the real client when an API key is configured", () => {
    delete process.env.USE_FAKE_BACKENDS;
    process.env.POSTHOG_API_KEY = "phc_x";
    expect(createPostHogClient().name).toBe("posthog");
  });
});
