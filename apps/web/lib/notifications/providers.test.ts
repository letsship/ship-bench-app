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

  it("maps a message onto the Cloudflare Email send request and returns the id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "cf_x" }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/email/send");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "bad token",
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/Cloudflare Email send failed/);
  });

  it("throws when the response has no message id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
