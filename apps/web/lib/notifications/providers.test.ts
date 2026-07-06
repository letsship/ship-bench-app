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

describe("cloudflare-email provider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts the recipient, subject, body and bearer token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "cf_x" }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "k", from: "Studiobook <s@b.co>" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer k" }),
        body: JSON.stringify({
          from: "Studiobook <s@b.co>",
          to: "a@b.co",
          subject: "Hi",
          text: "Body text",
        }),
      }),
    );
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });
    const provider = createCloudflareEmailProvider({ apiToken: "k", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(/Cloudflare Email send failed: 401/);
  });

  it("throws when Cloudflare Email returns no id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "k", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
