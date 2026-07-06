import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLOUDFLARE_EMAIL_ENDPOINT,
  createCloudflareEmailProvider,
} from "./cloudflare-email-provider";
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to the Cloudflare email send API with a Bearer token and the mapped body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "cf_x" }), { status: 200 }),
    );
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(CLOUDFLARE_EMAIL_ENDPOINT);
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer tok",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: "a@b.co", subject: "Hi", text: "Body text" }),
    });
  });

  it("surfaces the API response id as providerMessageId", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "msg-123" }), { status: 200 }),
    );
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("msg-123");
  });

  it("throws a descriptive error on a non-ok response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "bad recipient" }), {
        status: 422,
        statusText: "Unprocessable",
      }),
    );
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: 422/,
    );
  });

  it("throws when the response has no id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });

  it("throws when the network call rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed: network down/,
    );
  });
});
