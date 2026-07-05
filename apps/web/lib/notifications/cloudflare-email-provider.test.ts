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

  it("maps a message onto the Cloudflare Email send request", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: async () => ({ id: "cf_x" }),
    });
    const provider = createCloudflareEmailProvider({
      apiToken: "t",
      from: "Studiobook <s@b.co>",
    });
    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/email/send");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(init.body)).toEqual({
      from: "Studiobook <s@b.co>",
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws when Cloudflare returns a non-OK response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: async () => ({ errors: [{ message: "bad recipient" }] }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "t", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: bad recipient/,
    );
  });

  it("throws when Cloudflare returns no id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: async () => ({}),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "t", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
