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

  it("posts the message to the Cloudflare email send API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: async () => ({ success: true, result: { id: "cf_x" }, errors: [] }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    const result = await provider.send(message);

    expect(provider.name).toBe("cloudflare-email");
    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/email/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer tok",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws when the API responds with an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: async () => ({ success: false, errors: [{ message: "invalid recipient" }] }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/invalid recipient/);
  });

  it("throws when the API returns no message id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: async () => ({ success: true, result: {}, errors: [] }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });

  it("propagates a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/network down/);
  });
});
