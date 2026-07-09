import { describe, expect, it } from "vitest";
import { createFakeClient } from "./fake-client";
import { captureWaitlistJoined, getWaitlistExperimentVariant } from "./experiments";

describe("getWaitlistExperimentVariant", () => {
  it("returns control when the flag is exactly 'control'", async () => {
    const client = createFakeClient();
    client.setFlag("waitlist_experiment", "control");
    await expect(getWaitlistExperimentVariant(client, "m1")).resolves.toBe("control");
  });

  it("treats any other string as a variant", async () => {
    const client = createFakeClient();
    client.setFlag("waitlist_experiment", "treatment");
    await expect(getWaitlistExperimentVariant(client, "m1")).resolves.toBe("variant");
  });

  it("treats a boolean flag value as a variant", async () => {
    const client = createFakeClient();
    client.setFlag("waitlist_experiment", true);
    await expect(getWaitlistExperimentVariant(client, "m1")).resolves.toBe("variant");
  });

  it("treats an unconfigured flag as a variant (fails open)", async () => {
    const client = createFakeClient();
    await expect(getWaitlistExperimentVariant(client, "m1")).resolves.toBe("variant");
  });
});

describe("captureWaitlistJoined", () => {
  it("captures the goal event with only memberId and sessionId, no PII", async () => {
    const client = createFakeClient();
    await captureWaitlistJoined(client, "m1", "cs1");
    expect(client.captured).toHaveLength(1);
    expect(client.captured[0]).toEqual({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
  });
});
