import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLOUDFLARE_EMAIL_SEND_URL,
  createCloudflareEmailProvider,
} from "./cloudflare-email-provider";
import type { NotificationMessage } from "./types";

const message: NotificationMessage = {
  kind: "booking_confirmation",
  recipient: { memberId: "m1", email: "a@b.co", name: "A" },
  subject: "Hi",
  body: "Body text",
  data: {},
};

describe("cloudflare-email provider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts the message body to the Cloudflare endpoint and returns the provider message id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ id: "cf_msg_1" }),
    });

    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    const result = await provider.send(message);

    expect(provider.name).toBe("cloudflare-email");
    expect(result.providerMessageId).toBe("cf_msg_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      CLOUDFLARE_EMAIL_SEND_URL,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer tok",
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

  it("throws when the Cloudflare API responds with a non-OK status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "bad token",
    });

    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare email send failed: 401/,
    );
  });
});
