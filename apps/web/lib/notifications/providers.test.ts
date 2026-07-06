import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("posts the message to the Cloudflare email send API and returns the cf-ray id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: "OK",
      headers: new Headers({ "cf-ray": "abc123-ray" }),
      json: async () => ({
        success: true,
        errors: [],
        result: { delivered: ["a@b.co"], queued: [], permanent_bounces: [] },
      }),
    });
    const provider = createCloudflareProvider({
      apiToken: "t",
      accountId: "acct_1",
      from: "Studiobook <s@b.co>",
    });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("abc123-ray");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct_1/email/sending/send");
    expect(init).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body)).toEqual({
      from: "Studiobook <s@b.co>",
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws when Cloudflare returns an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      headers: new Headers(),
      json: async () => ({ success: false, errors: [{ message: "bad recipient" }] }),
    });
    const provider = createCloudflareProvider({
      apiToken: "t",
      accountId: "acct_1",
      from: "s@b.co",
    });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare email send failed: bad recipient/,
    );
  });

  it("throws when Cloudflare returns no cf-ray id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: "OK",
      headers: new Headers(),
      json: async () => ({
        success: true,
        errors: [],
        result: { delivered: ["a@b.co"], queued: [], permanent_bounces: [] },
      }),
    });
    const provider = createCloudflareProvider({
      apiToken: "t",
      accountId: "acct_1",
      from: "s@b.co",
    });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
