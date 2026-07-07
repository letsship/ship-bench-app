import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudflareProvider } from "./cloudflare-provider";
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

describe("cloudflare provider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a message to the Cloudflare Email API", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ result: { message_id: "cf_x" } })));
    const provider = createCloudflareProvider({ apiToken: "cf_token" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.cloudflare.com/client/v4/email/sending/send", {
      method: "POST",
      headers: {
        Authorization: "Bearer cf_token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: "a@b.co",
        subject: "Hi",
        text: "Body text",
      }),
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("surfaces delivery-status responses as provider ids", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: { delivered: ["a@b.co"], queued: [] } })),
    );
    const provider = createCloudflareProvider({ apiToken: "cf_token" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cloudflare:a@b.co");
  });

  it("throws when Cloudflare returns an error response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "bad recipient" }] }), { status: 400 }),
    );
    const provider = createCloudflareProvider({ apiToken: "cf_token" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: 400 .*bad recipient/,
    );
  });

  it("throws when Cloudflare returns no id or delivery status", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, result: {} })));
    const provider = createCloudflareProvider({ apiToken: "cf_token" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
