import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFakeProvider } from "./fake-provider";
import { createNotificationProvider } from "./provider";
import type { NotificationMessage } from "./types";

const message: NotificationMessage = {
  kind: "booking_confirmation",
  recipient: { memberId: "m1", email: "a@b.co", name: "A" },
  subject: "Hi",
  body: "Body text",
  data: {},
};

describe("fake provider", () => {
  it("records sent messages and returns a fake id", async () => {
    const provider = createFakeProvider();
    const result = await provider.send(message);
    expect(provider.name).toBe("fake");
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toBe(message);
    expect(result.providerMessageId.startsWith("fake_")).toBe(true);
  });
});

describe("createNotificationProvider", () => {
  const originalUseFakeBackends = process.env.USE_FAKE_BACKENDS;
  const originalApiToken = process.env.CF_EMAIL_API_TOKEN;

  beforeEach(() => {
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.CF_EMAIL_API_TOKEN;
  });

  afterEach(() => {
    if (originalUseFakeBackends === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = originalUseFakeBackends;
    if (originalApiToken === undefined) delete process.env.CF_EMAIL_API_TOKEN;
    else process.env.CF_EMAIL_API_TOKEN = originalApiToken;
  });

  it("returns the fake provider when USE_FAKE_BACKENDS=1, even without a token", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const provider = createNotificationProvider();
    expect(provider.name).toBe("fake");
  });

  it("throws a clear error when CF_EMAIL_API_TOKEN is missing outside fake mode", () => {
    expect(() => createNotificationProvider()).toThrow(/CF_EMAIL_API_TOKEN/);
  });

  it("returns the Cloudflare Email provider when a token is set", () => {
    process.env.CF_EMAIL_API_TOKEN = "tok";
    const provider = createNotificationProvider();
    expect(provider.name).toBe("cloudflare-email");
  });
});
