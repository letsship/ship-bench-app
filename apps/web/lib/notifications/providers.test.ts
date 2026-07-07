import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudflareEmailProvider } from "./cloudflare-email-provider";
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

describe("cloudflare email provider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a message onto the Cloudflare Email send params", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "cf_x" }),
    } as Response);
    const provider = createCloudflareEmailProvider({ apiToken: "k" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_x");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/email/send",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer k",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: "a@b.co", subject: "Hi", text: "Body text" }),
      }),
    );
  });

  it("throws when the HTTP response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);
    const provider = createCloudflareEmailProvider({ apiToken: "k" });
    await expect(provider.send(message)).rejects.toThrow(/Cloudflare Email send failed/);
  });

  it("throws when the response has no id", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);
    const provider = createCloudflareEmailProvider({ apiToken: "k" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});

describe("createNotificationProvider", () => {
  it("uses the fake provider when USE_FAKE_BACKENDS=1", () => {
    const prev = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
    delete process.env.CF_EMAIL_API_TOKEN;
    const provider = createNotificationProvider();
    expect(provider.name).toBe("fake");
    process.env.USE_FAKE_BACKENDS = prev;
  });

  it("throws a clear error when CF_EMAIL_API_TOKEN is missing", () => {
    const prevFake = process.env.USE_FAKE_BACKENDS;
    const prevToken = process.env.CF_EMAIL_API_TOKEN;
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.CF_EMAIL_API_TOKEN;
    expect(() => createNotificationProvider()).toThrow(
      "CF_EMAIL_API_TOKEN is not set. Set it for real email delivery, or run with USE_FAKE_BACKENDS=1.",
    );
    process.env.USE_FAKE_BACKENDS = prevFake;
    process.env.CF_EMAIL_API_TOKEN = prevToken;
  });
});
