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
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts to the Cloudflare email send API with the bearer token and message body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        errors: [],
        messages: [],
        result: { delivered: ["a@b.co"], permanent_bounces: [], queued: [] },
      }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acct_1" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toMatch(/^cf_/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct_1/email/sending/send");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws when the Cloudflare email API responds with a non-OK status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "invalid token",
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acct_1" });
    await expect(provider.send(message)).rejects.toThrow(/Cloudflare Email send failed/);
  });

  it("throws when the Cloudflare email API reports success: false", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        errors: [{ code: 1000, message: "Sender domain not verified" }],
        result: null,
      }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acct_1" });
    await expect(provider.send(message)).rejects.toThrow(/Sender domain not verified/);
  });
});

describe("createNotificationProvider", () => {
  const originalUseFake = process.env.USE_FAKE_BACKENDS;
  const originalToken = process.env.CF_EMAIL_API_TOKEN;
  const originalAccountId = process.env.CF_ACCOUNT_ID;

  afterEach(() => {
    if (originalUseFake === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = originalUseFake;
    if (originalToken === undefined) delete process.env.CF_EMAIL_API_TOKEN;
    else process.env.CF_EMAIL_API_TOKEN = originalToken;
    if (originalAccountId === undefined) delete process.env.CF_ACCOUNT_ID;
    else process.env.CF_ACCOUNT_ID = originalAccountId;
  });

  it("throws when CF_EMAIL_API_TOKEN is unset", () => {
    delete process.env.USE_FAKE_BACKENDS;
    delete process.env.CF_EMAIL_API_TOKEN;
    delete process.env.CF_ACCOUNT_ID;
    expect(() => createNotificationProvider()).toThrow(/CF_EMAIL_API_TOKEN is not set/);
  });

  it("throws when CF_ACCOUNT_ID is unset", () => {
    delete process.env.USE_FAKE_BACKENDS;
    process.env.CF_EMAIL_API_TOKEN = "tok";
    delete process.env.CF_ACCOUNT_ID;
    expect(() => createNotificationProvider()).toThrow(/CF_ACCOUNT_ID is not set/);
  });
});
