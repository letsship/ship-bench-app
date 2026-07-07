import { describe, expect, it, vi } from "vitest";
import { createNotificationProvider } from "./provider";

describe("createNotificationProvider", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the fake provider when USE_FAKE_BACKENDS=1", () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    const provider = createNotificationProvider();
    expect(provider.name).toBe("fake");
  });

  it("throws a clear error when CF_EMAIL_API_TOKEN is not set", () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "0");
    vi.stubEnv("CF_EMAIL_API_TOKEN", undefined as unknown as string);
    expect(() => createNotificationProvider()).toThrow(
      "CF_EMAIL_API_TOKEN is not set",
    );
  });

  it("returns the cloudflare email provider when the token is set", () => {
    vi.stubEnv("USE_FAKE_BACKENDS", "0");
    vi.stubEnv("CF_EMAIL_API_TOKEN", "real-token");
    const provider = createNotificationProvider();
    expect(provider.name).toBe("cloudflare-email");
  });
});