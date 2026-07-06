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

  it("posts the message to the Cloudflare email send API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: async () => ({ success: true, result: { id: "cf_x" } }),
    });
    const provider = createCloudflareEmailProvider({
      apiToken: "k",
      from: "Studiobook <s@b.co>",
    });
    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/email/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer k",
          "Content-Type": "application/json",
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      from: "Studiobook <s@b.co>",
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws when the Cloudflare API responds with an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: async () => ({ success: false, errors: [{ message: "bad recipient" }] }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "k", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: bad recipient/,
    );
  });

  it("throws when constructed without an API token", () => {
    expect(() => createCloudflareEmailProvider({ apiToken: "", from: "s@b.co" })).toThrow(
      /Cloudflare Email API token is missing/,
    );
  });
});
