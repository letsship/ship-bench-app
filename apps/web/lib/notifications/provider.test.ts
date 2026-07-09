import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNotificationProvider } from "./provider";

describe("createNotificationProvider", () => {
  const originalUseFake = process.env.USE_FAKE_BACKENDS;
  const originalToken = process.env.CF_EMAIL_API_TOKEN;

  beforeEach(() => {
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.CF_EMAIL_API_TOKEN;
  });

  afterEach(() => {
    if (originalUseFake === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = originalUseFake;
    if (originalToken === undefined) delete process.env.CF_EMAIL_API_TOKEN;
    else process.env.CF_EMAIL_API_TOKEN = originalToken;
  });

  it("returns the fake provider when USE_FAKE_BACKENDS=1", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const provider = createNotificationProvider();
    expect(provider.name).toBe("fake");
  });

  it("throws a clear error when CF_EMAIL_API_TOKEN is unset and fake backends are off", () => {
    expect(() => createNotificationProvider()).toThrow(/CF_EMAIL_API_TOKEN is not set/);
  });

  it("returns the Cloudflare provider when the token is present", () => {
    process.env.CF_EMAIL_API_TOKEN = "t";
    const provider = createNotificationProvider();
    expect(provider.name).toBe("cloudflare-email");
  });
});
