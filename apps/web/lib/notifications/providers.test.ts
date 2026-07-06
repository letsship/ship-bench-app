import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudflareEmailProvider } from "./cloudflare-email-provider";
import { createFakeProvider } from "./fake-provider";
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

  afterEach(() => {
    vi.unstubGlobal("fetch");
  });

  it("sends a POST to the Cloudflare email send API with the correct shape", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { id: "cf_msg_1" } }),
    });

    const provider = createCloudflareEmailProvider({
      apiToken: "tok_abc",
      accountId: "acct_123",
    });

    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_msg_1");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/accounts/acct_123/email/routing/email/send");
    expect(opts.method).toBe("POST");
    expect(opts.headers).toEqual({
      Authorization: "Bearer tok_abc",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws when Cloudflare returns a non-OK status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    const provider = createCloudflareEmailProvider({
      apiToken: "tok_abc",
      accountId: "acct_123",
    });

    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare email send failed: 403 Forbidden/,
    );
  });

  it("throws when Cloudflare returns success=false", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        errors: [{ message: "invalid recipient" }],
      }),
    });

    const provider = createCloudflareEmailProvider({
      apiToken: "tok_abc",
      accountId: "acct_123",
    });

    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare email send failed/,
    );
  });

  it("throws when Cloudflare returns no message id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: {} }),
    });

    const provider = createCloudflareEmailProvider({
      apiToken: "tok_abc",
      accountId: "acct_123",
    });

    await expect(provider.send(message)).rejects.toThrow(
      /no message id/,
    );
  });
});
