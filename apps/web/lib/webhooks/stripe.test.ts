import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe";

const encoder = new TextEncoder();

async function sign(body: string, secret: string, timestamp: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `t=${timestamp},v1=${hex}`;
}

describe("verifyStripeSignature", () => {
  const body = JSON.stringify({ id: "evt_test", type: "invoice.paid" });
  const secret = "whsec_test";
  const timestamp = "1785585600";

  it("accepts a valid signature", async () => {
    expect(await verifyStripeSignature(body, await sign(body, secret, timestamp), secret)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    expect(
      await verifyStripeSignature(
        `${body} `,
        await sign(body, secret, timestamp),
        secret,
      ),
    ).toBe(false);
  });

  it("rejects a wrong secret", async () => {
    expect(await verifyStripeSignature(body, await sign(body, secret, timestamp), "wrong")).toBe(false);
  });

  it.each([null, ""])("rejects a missing header: %s", async (header) => {
    expect(await verifyStripeSignature(body, header, secret)).toBe(false);
  });

  it.each(["v1=abc", "t=,v1=abc", "t=123", "t=123,v1="])(
    "rejects malformed headers: %s",
    async (header) => {
      expect(await verifyStripeSignature(body, header, secret)).toBe(false);
    },
  );
});
