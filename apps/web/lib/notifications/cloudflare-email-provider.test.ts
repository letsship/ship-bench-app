import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudflareEmailProvider } from "./cloudflare-email-provider";
import type { NotificationMessage } from "./types";

const message: NotificationMessage = {
  kind: "booking_confirmation",
  recipient: { memberId: "m1", email: "a@b.co", name: "A" },
  subject: "Hi",
  body: "Body text",
  data: {},
};

describe("cloudflare-email provider", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("issues a single POST with the exact { to, subject, text } body and bearer auth", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ result: { id: "cf_x" } }), { status: 200 }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    const result = await provider.send(message);

    expect(result.providerMessageId).toBe("cf_x");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/email/send");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({
      to: "a@b.co",
      subject: "Hi",
      text: "Body text",
    });
  });

  it("throws a descriptive error on a non-2xx response", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "bad recipient" }] }), {
        status: 400,
        statusText: "Bad Request",
      }),
    );

    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/Cloudflare Email send failed.*bad recipient/);
  });

  it("throws when the response has no message id", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ result: {} }), { status: 200 }));

    const provider = createCloudflareEmailProvider({ apiToken: "tok" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
