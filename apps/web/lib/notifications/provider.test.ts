import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fake-provider", () => ({
  createFakeProvider: vi.fn(() => ({ name: "fake" })),
}));
vi.mock("./cloudflare-email-provider", () => ({
  createCloudflareEmailProvider: vi.fn(() => ({
    name: "cloudflare-email",
  })),
}));

const { createFakeProvider } = await import("./fake-provider");
const { createCloudflareEmailProvider } = await import(
  "./cloudflare-email-provider"
);

describe("createNotificationProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.mocked(createFakeProvider).mockClear();
    vi.mocked(createCloudflareEmailProvider).mockClear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the fake provider when USE_FAKE_BACKENDS=1, with no CF_EMAIL_API_TOKEN required", async () => {
    delete process.env.CF_EMAIL_API_TOKEN;
    process.env.USE_FAKE_BACKENDS = "1";
    const { createNotificationProvider } = await import("./provider");

    const provider = createNotificationProvider();

    expect(createFakeProvider).toHaveBeenCalledTimes(1);
    expect(createCloudflareEmailProvider).not.toHaveBeenCalled();
    expect(provider.name).toBe("fake");
  });

  it("throws a clear error when CF_EMAIL_API_TOKEN is missing and fake backends are off", async () => {
    delete process.env.CF_EMAIL_API_TOKEN;
    delete process.env.USE_FAKE_BACKENDS;
    const { createNotificationProvider } = await import("./provider");

    expect(() => createNotificationProvider()).toThrow(/CF_EMAIL_API_TOKEN/);
    expect(createCloudflareEmailProvider).not.toHaveBeenCalled();
  });

  it("constructs the Cloudflare provider with the token when it is set", async () => {
    process.env.CF_EMAIL_API_TOKEN = "tok";
    delete process.env.USE_FAKE_BACKENDS;
    const { createNotificationProvider } = await import("./provider");

    const provider = createNotificationProvider();

    expect(createCloudflareEmailProvider).toHaveBeenCalledWith({
      apiToken: "tok",
    });
    expect(createFakeProvider).not.toHaveBeenCalled();
    expect(provider.name).toBe("cloudflare-email");
  });
});
