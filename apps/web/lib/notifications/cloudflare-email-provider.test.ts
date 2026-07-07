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
  const fetch = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetch.mockReset();
  });

  it("POSTs to the send endpoint with bearer auth and a { to, subject, text } body", async () => {
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ id: "cf_msg_1" }), { status: 200 }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "tok_abc" });
    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_msg_1");
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, opts] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.email.cloudflare.com/send");
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tok_abc",
    );
    expect(JSON.parse(opts.body as string)).toEqual({
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws on a non-2xx response", async () => {
    fetch.mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "bad" });
    await expect(provider.send(message)).rejects.toThrow(
      /Cloudflare Email send failed \(401\)/,
    );
  });

  it("throws when the response has no id", async () => {
    fetch.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(
      /no message id/,
    );
  });

  it("exposes the provider name", () => {
    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    expect(provider.name).toBe("cloudflare-email");
  });
});
