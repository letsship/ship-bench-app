import { describe, expect, it } from "vitest";
import { createFakeExperimentClient } from "./fake-client";

describe("fake experiment client", () => {
  it("defaults to a non-control variant when unconfigured", async () => {
    const client = createFakeExperimentClient();
    expect(await client.getExperimentVariant("m1", "waitlist_experiment")).toBe("test");
  });

  it("returns a per-member configured variant", async () => {
    const client = createFakeExperimentClient({ m1: "control" });
    expect(await client.getExperimentVariant("m1", "waitlist_experiment")).toBe("control");
    expect(await client.getExperimentVariant("m2", "waitlist_experiment")).toBe("test");
  });

  it("supports setting a variant after creation", async () => {
    const client = createFakeExperimentClient();
    client.setVariant("m1", "control");
    expect(await client.getExperimentVariant("m1", "waitlist_experiment")).toBe("control");
  });

  it("records captured events exactly as passed", async () => {
    const client = createFakeExperimentClient();
    await client.captureEvent({
      distinctId: "m1",
      event: "waitlist_joined",
      properties: { sessionId: "cs1" },
    });
    expect(client.captured).toEqual([
      { distinctId: "m1", event: "waitlist_joined", properties: { sessionId: "cs1" } },
    ]);
  });
});
