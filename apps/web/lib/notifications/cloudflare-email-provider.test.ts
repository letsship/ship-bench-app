import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudflareEmailProvider } from "./cloudflare-email-provider";
import type { NotificationMessage } from "./types";

const message: NotificationMessage = {
  kind: "booking_confirmation",
  recipient: { memberId: "m1", email: "a@b.co", name: "A" },
  subject: "Hi",
  body: "Body text",
  data: {},
};

describe("cloudflare email provider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("maps a message onto the Cloudflare send request", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "cf_x" }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
        body: JSON.stringify({ to: "a@b.co", subject: "Hi", text: "Body text" }),
      }),
    );
  });

  it("throws when the Cloudflare API returns a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad recipient",
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/Cloudflare Email send failed/);
  });

  it("throws when the Cloudflare API returns no id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});

describe("createNotificationProvider missing token", () => {
  it("throws a clear error when CF_EMAIL_API_TOKEN is missing", async () => {
    vi.resetModules();
    const originalToken = process.env.CF_EMAIL_API_TOKEN;
    const originalFake = process.env.USE_FAKE_BACKENDS;
    delete process.env.CF_EMAIL_API_TOKEN;
    delete process.env.USE_FAKE_BACKENDS;

    const { createNotificationProvider } = await import("./provider");
    expect(() => createNotificationProvider()).toThrow(/CF_EMAIL_API_TOKEN/);

    if (originalToken === undefined) delete process.env.CF_EMAIL_API_TOKEN;
    else process.env.CF_EMAIL_API_TOKEN = originalToken;
    if (originalFake === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = originalFake;
  });
});
