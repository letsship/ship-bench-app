import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe";

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

async function header(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const v1 = await sign(secret, `${timestamp}.${rawBody}`);
  return `t=${timestamp},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  const secret = "whsec_test_secret";
  const rawBody = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
  const timestamp = "1700000000";

  it("accepts a correctly-signed payload", async () => {
    const sig = await header(secret, timestamp, rawBody);
    expect(await verifyStripeSignature(rawBody, sig, secret)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const sig = await header(secret, timestamp, rawBody);
    const tampered = JSON.stringify({ id: "evt_1", type: "invoice.voided" });
    expect(await verifyStripeSignature(tampered, sig, secret)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    const sig = await header("whsec_wrong_secret", timestamp, rawBody);
    expect(await verifyStripeSignature(rawBody, sig, secret)).toBe(false);
  });

  it("rejects a missing signature header", async () => {
    expect(await verifyStripeSignature(rawBody, null, secret)).toBe(false);
  });

  it("rejects a malformed signature header", async () => {
    expect(await verifyStripeSignature(rawBody, "not-a-valid-header", secret)).toBe(false);
  });

  it("rejects when the webhook secret is not configured", async () => {
    const sig = await header(secret, timestamp, rawBody);
    expect(await verifyStripeSignature(rawBody, sig, undefined)).toBe(false);
  });
});
