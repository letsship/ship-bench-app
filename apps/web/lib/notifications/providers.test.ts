import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a message onto the Cloudflare Email send params", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "cf_msg_1" }),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "my-token" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("cf_msg_1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.email.cloudflare.com/send",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer my-token",
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

  it("throws when Cloudflare returns an error status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("unauthorized"),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "bad" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed \(401\): unauthorized/,
    );
  });

  it("throws when Cloudflare returns no id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const provider = createCloudflareEmailProvider({ apiToken: "t" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email returned no message id/,
    );
  });
});