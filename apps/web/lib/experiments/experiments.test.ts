import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeExperimentsClient } from "./fake-client";
import { createPostHogExperimentsClient } from "./posthog-client";
import { createExperimentsClient } from "./provider";

vi.mock("posthog-node", () => ({ PostHog: vi.fn() }));

describe("fake experiments client", () => {
  it("returns undefined for an unset flag", async () => {
    const client = createFakeExperimentsClient();
    expect(await client.getFlag("waitlist_experiment", "m1")).toBeUndefined();
  });

  it("returns a preset flag value scoped to key + distinctId", async () => {
    const client = createFakeExperimentsClient();
    client.setFlag("waitlist_experiment", "m1", "control");
    expect(await client.getFlag("waitlist_experiment", "m1")).toBe("control");
    expect(await client.getFlag("waitlist_experiment", "m2")).toBeUndefined();
  });

  it("records captured events", async () => {
    const client = createFakeExperimentsClient();
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

describe("posthog experiments client", () => {
  const evaluateFlags = vi.fn();
  const captureImmediate = vi.fn();

  beforeEach(() => {
    evaluateFlags.mockReset();
    captureImmediate.mockReset();
    vi.mocked(PostHog).mockImplementation(
      () => ({ evaluateFlags, captureImmediate }) as unknown as PostHog,
    );
  });

  it("evaluates the flag and reads it off the snapshot", async () => {
    const getFlag = vi.fn().mockReturnValue("control");
    evaluateFlags.mockResolvedValue({ getFlag });
    const client = createPostHogExperimentsClient({ projectToken: "phc_x" });
    const value = await client.getFlag("waitlist_experiment", "m1");
    expect(value).toBe("control");
    expect(evaluateFlags).toHaveBeenCalledWith("m1", { flagKeys: ["waitlist_experiment"] });
    expect(getFlag).toHaveBeenCalledWith("waitlist_experiment");
  });

  it("captures immediately so the event is sent before the request ends", async () => {
    captureImmediate.mockResolvedValue(undefined);
    const client = createPostHogExperimentsClient({ projectToken: "phc_x" });
    await client.capture({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "s1" },
    });
    expect(captureImmediate).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "s1" },
    });
  });
});

describe("createExperimentsClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

  it("returns the fake client under USE_FAKE_BACKENDS=1", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    expect(createExperimentsClient().name).toBe("fake");
  });

  it("fails open to the fake client when no project token is set", () => {
    expect(createExperimentsClient().name).toBe("fake");
  });

  it("returns the real PostHog client when a project token is set", () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_x";
    expect(createExperimentsClient().name).toBe("posthog");
  });
});
