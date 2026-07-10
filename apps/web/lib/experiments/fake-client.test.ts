import { describe, expect, it } from "vitest";
import { createFakeExperimentClient } from "./fake-client";

describe("fake experiment client", () => {
  it("returns the default variant for a member with no override", async () => {
    const client = createFakeExperimentClient();
    expect(await client.getWaitlistVariant("m1")).toBe("test");
  });

  it("returns a per-member variant set via setVariant", async () => {
    const client = createFakeExperimentClient();
    client.setVariant("m1", "control");
    client.setVariant("m2", "test");
    expect(await client.getWaitlistVariant("m1")).toBe("control");
    expect(await client.getWaitlistVariant("m2")).toBe("test");
  });

  it("honors a custom default variant", async () => {
    const client = createFakeExperimentClient("holdout");
    expect(await client.getWaitlistVariant("m1")).toBe("holdout");
  });

  it("records captureWaitlistJoined calls with no extra PII", async () => {
    const client = createFakeExperimentClient();
    await client.captureWaitlistJoined({ memberId: "m1", sessionId: "cs1" });
    expect(client.captured).toEqual([{ memberId: "m1", sessionId: "cs1" }]);
  });
});
