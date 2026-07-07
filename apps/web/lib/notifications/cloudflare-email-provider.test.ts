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
    vi.unstubAllGlobals();
  });

  it("posts the correct URL, headers, and body and returns the provider message id", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ result: { message_id: "cf-msg-id" } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const provider = createCloudflareEmailProvider({
      apiToken: "my-token",
      accountId: "acc123",
      from: "Studiobook <hello@riverbank.studio>",
    });

    const result = await provider.send(message);

    expect(provider.name).toBe("cloudflare-email");
    expect(result.providerMessageId).toBe("cf-msg-id");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acc123/email/sending/send",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer my-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Studiobook <hello@riverbank.studio>",
          to: "a@b.co",
          subject: "Hi",
          text: "Body text",
        }),
      },
    );
  });

  it("throws on a non-OK response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ errors: [{ message: "bad request" }] }),
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const provider = createCloudflareEmailProvider({
      apiToken: "my-token",
      accountId: "acc123",
      from: "hello@riverbank.studio",
    });

    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed \(400\)/,
    );
  });

  it("throws when the response contains no message id", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const provider = createCloudflareEmailProvider({
      apiToken: "my-token",
      accountId: "acc123",
      from: "hello@riverbank.studio",
    });

    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });

  it("throws when constructed with an empty api token", () => {
    expect(() =>
      createCloudflareEmailProvider({
        apiToken: "",
        accountId: "acc123",
        from: "hello@riverbank.studio",
      }),
    ).toThrow(/CF_EMAIL_API_TOKEN is required/);
  });

  it("throws when constructed with an empty account id", () => {
    expect(() =>
      createCloudflareEmailProvider({
        apiToken: "my-token",
        accountId: "",
        from: "hello@riverbank.studio",
      }),
    ).toThrow(/CLOUDFLARE_ACCOUNT_ID is required/);
  });
});
