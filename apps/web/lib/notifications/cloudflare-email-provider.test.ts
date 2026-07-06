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
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "cf_x" }), { status: 200 }));
    const provider = createCloudflareEmailProvider({ apiToken: "k", from: "Studiobook <s@b.co>" });
    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/email/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer k",
          "Content-Type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      from: "Studiobook <s@b.co>",
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue(new Response("bad recipient", { status: 400 }));
    const provider = createCloudflareEmailProvider({ apiToken: "k", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(/Cloudflare Email send failed: 400/);
  });

  it("throws when the response has no id", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const provider = createCloudflareEmailProvider({ apiToken: "k", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });

  it("throws when the API token is missing", () => {
    expect(() => createCloudflareEmailProvider({ apiToken: "", from: "s@b.co" })).toThrow(
      /API token is required/,
    );
  });
});
