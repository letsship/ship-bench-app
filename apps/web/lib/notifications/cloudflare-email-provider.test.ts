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
    vi.stubGlobal("fetch", vi.fn());
  });

  it("maps a message onto the Cloudflare send params", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ result: { id: "cf_x" } }), { status: 200 }),
    );
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_x");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/REPLACE_WITH_ACCOUNT_ID/email/routes/send",
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

  it("throws when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("bad request", { status: 400 }),
    );
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: 400 bad request/,
    );
  });

  it("throws when the response has no message id", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    );
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email response did not contain a message id/,
    );
  });

  it("throws a clear error when the api token is empty", async () => {
    const provider = createCloudflareEmailProvider({ apiToken: "" });
    await expect(provider.send(message)).rejects.toThrow(
      /CF_EMAIL_API_TOKEN is not set/,
    );
  });
});
