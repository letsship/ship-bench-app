import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNotificationProvider } from "./provider";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("createNotificationProvider", () => {
  it("returns the fake provider when USE_FAKE_BACKENDS=1, even with no token", () => {
    delete process.env.CF_EMAIL_API_TOKEN;
    process.env.USE_FAKE_BACKENDS = "1";
    const provider = createNotificationProvider();
    expect(provider.name).toBe("fake");
  });

  it("throws a clear, descriptive error when the token is missing and fake mode is off", () => {
    delete process.env.CF_EMAIL_API_TOKEN;
    delete process.env.USE_FAKE_BACKENDS;
    expect(() => createNotificationProvider()).toThrow(/CF_EMAIL_API_TOKEN/);
  });

  it("returns the Cloudflare adapter when the token is set and fake mode is off", () => {
    delete process.env.USE_FAKE_BACKENDS;
    process.env.CF_EMAIL_API_TOKEN = "tok";
    const provider = createNotificationProvider();
    expect(provider.name).toBe("cloudflare-email");
  });
});
