import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createNotificationProvider", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the fake provider when USE_FAKE_BACKENDS=1, regardless of the token", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    vi.stubEnv("CF_EMAIL_API_TOKEN", "");
    const { createNotificationProvider } = await import("./provider");
    const provider = createNotificationProvider();
    expect(provider.name).toBe("fake");
  });

  it("throws a clear error when CF_EMAIL_API_TOKEN is missing", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "0");
    vi.stubEnv("CF_EMAIL_API_TOKEN", "");
    const { createNotificationProvider } = await import("./provider");
    expect(() => createNotificationProvider()).toThrow(/CF_EMAIL_API_TOKEN is not set/);
  });

  it("returns the Cloudflare email provider when the token is set", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "0");
    vi.stubEnv("CF_EMAIL_API_TOKEN", "tok");
    const { createNotificationProvider } = await import("./provider");
    const provider = createNotificationProvider();
    expect(provider.name).toBe("cloudflare-email");
  });
});
