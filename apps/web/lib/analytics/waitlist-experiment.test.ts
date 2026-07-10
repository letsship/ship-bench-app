import { describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "./fake-provider";
import type { AnalyticsClient } from "./types";
import {
  WAITLIST_EXPERIMENT_FLAG_KEY,
  getWaitlistExperimentGroup,
  recordWaitlistJoined,
} from "./waitlist-experiment";

describe("getWaitlistExperimentGroup", () => {
  it("resolves to control only for an exact 'control' flag value", async () => {
    const client = createFakeProvider();
    client.setFlag("m1", WAITLIST_EXPERIMENT_FLAG_KEY, "control");
    expect(await getWaitlistExperimentGroup(client, "m1")).toBe("control");
  });

  it("resolves any other variant string to 'variant'", async () => {
    const client = createFakeProvider();
    client.setFlag("m1", WAITLIST_EXPERIMENT_FLAG_KEY, "test");
    expect(await getWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });

  it("fails open to 'variant' when the flag is unset", async () => {
    const client = createFakeProvider();
    expect(await getWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });

  it("fails open to 'variant' when flag evaluation throws", async () => {
    const client: AnalyticsClient = {
      getFlag: vi.fn().mockRejectedValue(new Error("posthog unreachable")),
      capture: vi.fn(),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getWaitlistExperimentGroup(client, "m1")).toBe("variant");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("recordWaitlistJoined", () => {
  it("captures waitlist_joined with the member id as distinct id and only the session id in properties", async () => {
    const client = createFakeProvider();
    await recordWaitlistJoined(client, { memberId: "m1", sessionId: "cs1" });
    expect(client.captured).toEqual([
      { distinctId: "m1", event: "waitlist_joined", properties: { sessionId: "cs1" } },
    ]);
  });
});
