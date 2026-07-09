import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakePostHogClient } from "./fake-client";
import { createRealPostHogClient } from "./posthog-client";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

describe("fake PostHog client", () => {
  it("returns configured flag values", async () => {
    const client = createFakePostHogClient();
    client.setFeatureFlag("waitlist_experiment", "m1", "control");
    expect(await client.getFeatureFlag("waitlist_experiment", "m1")).toBe("control");
    expect(await client.getFeatureFlag("waitlist_experiment", "m2")).toBeUndefined();
  });

  it("records captured events", async () => {
    const client = createFakePostHogClient();
    await client.capture({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "s1" },
    });
    expect(client.captured).toEqual([
      { distinctId: "m1", event: "waitlist_joined", properties: { sessionId: "s1" } },
    ]);
  });
});

describe("real PostHog client", () => {
  const getFeatureFlag = vi.fn();
  const capture = vi.fn();

  beforeEach(() => {
    getFeatureFlag.mockReset();
    capture.mockReset();
    vi.mocked(PostHog).mockImplementation(
      () => ({ getFeatureFlag, capture }) as unknown as PostHog,
    );
  });

  it("constructs the SDK client with an immediate-flush config", () => {
    createRealPostHogClient({ apiKey: "k", host: "https://us.i.posthog.com" });
    expect(PostHog).toHaveBeenCalledWith("k", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  });

  it("delegates getFeatureFlag to the SDK client", async () => {
    getFeatureFlag.mockResolvedValue("control");
    const client = createRealPostHogClient({ apiKey: "k", host: "https://us.i.posthog.com" });
    const value = await client.getFeatureFlag("waitlist_experiment", "m1");
    expect(value).toBe("control");
    expect(getFeatureFlag).toHaveBeenCalledWith("waitlist_experiment", "m1");
  });

  it("delegates capture to the SDK client", async () => {
    const client = createRealPostHogClient({ apiKey: "k", host: "https://us.i.posthog.com" });
    await client.capture({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "s1" },
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "s1" },
    });
  });
});
