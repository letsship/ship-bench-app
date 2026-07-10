import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPostHogClient } from "./posthog-client";

const evaluateFlags = vi.fn();
const capture = vi.fn();
const shutdown = vi.fn();

vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    evaluateFlags,
    capture,
    shutdown,
  })),
}));

beforeEach(() => {
  vi.mocked(PostHog).mockClear();
  evaluateFlags.mockReset();
  capture.mockReset();
  shutdown.mockReset().mockResolvedValue(undefined);
});

describe("posthog experiment client", () => {
  it("evaluates the waitlist_experiment flag for the member and reads it via getFlag", async () => {
    const getFlag = vi.fn().mockReturnValue("test");
    evaluateFlags.mockResolvedValue({ getFlag });
    const client = createPostHogClient({ apiKey: "k", host: "https://h" });

    const variant = await client.getWaitlistVariant("m1");

    expect(PostHog).toHaveBeenCalledWith("k", { host: "https://h", flushAt: 1, flushInterval: 0 });
    expect(evaluateFlags).toHaveBeenCalledWith("m1", { flagKeys: ["waitlist_experiment"] });
    expect(getFlag).toHaveBeenCalledWith("waitlist_experiment");
    expect(variant).toBe("test");
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("falls back to a non-control variant when the flag is unset", async () => {
    evaluateFlags.mockResolvedValue({ getFlag: vi.fn().mockReturnValue(undefined) });
    const client = createPostHogClient({ apiKey: "k", host: "https://h" });

    const variant = await client.getWaitlistVariant("m1");

    expect(variant).not.toBe("control");
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("captures waitlist_joined with the member id as distinct id and no extra PII", async () => {
    const client = createPostHogClient({ apiKey: "k", host: "https://h" });

    await client.captureWaitlistJoined({ memberId: "m1", sessionId: "cs1" });

    expect(capture).toHaveBeenCalledWith({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("always awaits shutdown even when evaluateFlags throws", async () => {
    evaluateFlags.mockRejectedValue(new Error("network down"));
    const client = createPostHogClient({ apiKey: "k", host: "https://h" });

    await expect(client.getWaitlistVariant("m1")).rejects.toThrow("network down");
    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
