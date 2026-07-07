import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCfEmailProvider } from "./cf-email-provider";
import type { NotificationMessage } from "./types";

const message: NotificationMessage = {
  kind: "booking_confirmation",
  recipient: { memberId: "m1", email: "a@b.co", name: "A" },
  subject: "Hi",
  body: "Body text",
  data: {},
};

const ENDPOINT = "https://api.cloudflare.com/client/v4/email/send";

describe("cloudflare email provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts to the Cloudflare email send API with bearer auth and the expected body", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { id: "cf_msg_1" } }),
    });

    const provider = createCfEmailProvider({ apiKey: "token-123" });
    const result = await provider.send(message);

    expect(provider.name).toBe("cloudflare-email");
    expect(result.providerMessageId).toBe("cf_msg_1");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "a@b.co",
          subject: "Hi",
          text: "Body text",
        }),
      },
    );
  });

  it("surfaces the provider message id from a top-level id field", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "cf_flat_id" }),
    });

    const provider = createCfEmailProvider({ apiKey: "token-123" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_flat_id");
  });

  it("throws when the API responds with a non-OK status", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ errors: [{ message: "bad token" }] }),
    });

    const provider = createCfEmailProvider({ apiKey: "token-123" });
    await expect(provider.send(message)).rejects.toThrow(/Cloudflare email send failed: 401/);
  });

  it("throws when the response contains no message id", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const provider = createCfEmailProvider({ apiKey: "token-123" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
