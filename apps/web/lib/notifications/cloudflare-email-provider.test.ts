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

  it("posts the message to the Cloudflare send API and maps the returned id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "cf_x" }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "token" });
    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/email/sending/send",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: "a@b.co", subject: "Hi", text: "Body text" }),
      },
    );
  });

  it("throws when the Cloudflare API responds with an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => "bad recipient",
    });
    const provider = createCloudflareEmailProvider({ apiToken: "token" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: bad recipient/,
    );
  });
});
