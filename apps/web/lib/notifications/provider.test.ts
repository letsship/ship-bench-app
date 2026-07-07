import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Both vendors are mocked so these tests never make a real network call or
// depend on the adapters' internals — they only assert on the branching of
// createNotificationProvider().
vi.mock("./cloudflare-email-provider", () => ({
  createCloudflareEmailProvider: vi.fn(() => ({
    name: "cloudflare-email",
    send: vi.fn(),
  })),
}));
vi.mock("./fake-provider", () => ({
  createFakeProvider: vi.fn(() => ({
    name: "fake",
    sent: [],
    send: vi.fn(),
  })),
}));

import { createCloudflareEmailProvider } from "./cloudflare-email-provider";
import { createFakeProvider } from "./fake-provider";
import { createNotificationProvider } from "./provider";

describe("createNotificationProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.CF_EMAIL_API_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the fake provider when USE_FAKE_BACKENDS=1", () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const provider = createNotificationProvider();
    expect(createFakeProvider).toHaveBeenCalled();
    expect(createCloudflareEmailProvider).not.toHaveBeenCalled();
    expect(provider.name).toBe("fake");
  });

  it("throws a clear, descriptive error when CF_EMAIL_API_TOKEN is missing", () => {
    expect(() => createNotificationProvider()).toThrow(/CF_EMAIL_API_TOKEN/);
    expect(createCloudflareEmailProvider).not.toHaveBeenCalled();
  });

  it("constructs the Cloudflare adapter when CF_EMAIL_API_TOKEN is present", () => {
    process.env.CF_EMAIL_API_TOKEN = "tok-123";
    const provider = createNotificationProvider();
    expect(createCloudflareEmailProvider).toHaveBeenCalledWith({ apiToken: "tok-123" });
    expect(provider.name).toBe("cloudflare-email");
  });
});
