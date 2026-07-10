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

  it("maps a message onto the Cloudflare Email send request", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => (name === "cf-ray" ? "cf_ray_x" : null) },
      json: async () => ({
        success: true,
        errors: [],
        result: { delivered: ["a@b.co"], permanent_bounces: [], queued: [] },
      }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acc_1" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_ray_x");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acc_1/email/sending/send",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: "a@b.co", subject: "Hi", text: "Body text" }),
      },
    );
  });

  it("throws when Cloudflare Email returns a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad recipient",
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acc_1" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: 400 bad recipient/,
    );
  });

  it("throws when Cloudflare Email reports an API error", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({
        success: false,
        errors: [{ code: 1000, message: "Sender domain not verified" }],
        result: null,
      }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acc_1" });
    await expect(provider.send(message)).rejects.toThrow(/Sender domain not verified/);
  });

  it("throws when Cloudflare Email returns no message id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({
        success: true,
        errors: [],
        result: { delivered: ["a@b.co"], permanent_bounces: [], queued: [] },
      }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok", accountId: "acc_1" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
