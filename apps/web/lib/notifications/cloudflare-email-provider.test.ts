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
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("issues a POST with the correct URL, headers, and exact body shape", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ result: { id: "cf_123" } }), { status: 200 }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acc_123" });
    await provider.send(message);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acc_123/email/routing/send",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: "a@b.co", subject: "Hi", text: "Body text" }),
      }),
    );
  });

  it("surfaces providerMessageId from the response", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ result: { id: "cf_abc" } }), { status: 200 }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acc_123" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_abc");
  });

  it("surfaces providerMessageId from a plain { id } response", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "cf_xyz" }), { status: 200 }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acc_123" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_xyz");
  });

  it("throws a clear error when the response is not ok", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acc_123" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: 400/,
    );
  });

  it("throws a clear error when CF_EMAIL_API_TOKEN is missing", () => {
    expect(() => createCloudflareEmailProvider({ apiToken: "", accountId: "acc_123" })).toThrow(
      /CF_EMAIL_API_TOKEN is not set/,
    );
  });

  it("throws a clear error when CF_ACCOUNT_ID is missing", () => {
    expect(() => createCloudflareEmailProvider({ apiToken: "tok", accountId: "" })).toThrow(
      /CF_ACCOUNT_ID is not set/,
    );
  });
});
