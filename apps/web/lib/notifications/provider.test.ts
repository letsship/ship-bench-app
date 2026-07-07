import { beforeEach, describe, expect, it, vi } from "vitest";

describe("createNotificationProvider", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns the fake provider when USE_FAKE_BACKENDS=1", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    const { createNotificationProvider } = await import("./provider");
    const provider = createNotificationProvider();
    expect(provider.name).toBe("fake");
  });

  it("throws a clear error when CF_EMAIL_API_TOKEN is missing", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "");
    vi.stubEnv("CF_EMAIL_API_TOKEN", "");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc123");
    const { createNotificationProvider } = await import("./provider");
    expect(() => createNotificationProvider()).toThrow(
      /CF_EMAIL_API_TOKEN is not set/,
    );
  });

  it("throws a clear error when CLOUDFLARE_ACCOUNT_ID is missing", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "");
    vi.stubEnv("CF_EMAIL_API_TOKEN", "token");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    const { createNotificationProvider } = await import("./provider");
    expect(() => createNotificationProvider()).toThrow(
      /CLOUDFLARE_ACCOUNT_ID is not set/,
    );
  });

  it("returns the cloudflare-email provider when both token and account id are present", async () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "");
    vi.stubEnv("CF_EMAIL_API_TOKEN", "token");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc123");
    const { createNotificationProvider } = await import("./provider");
    const provider = createNotificationProvider();
    expect(provider.name).toBe("cloudflare-email");
  });
});
