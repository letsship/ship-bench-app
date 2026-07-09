import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-signature";

const SECRET = "whsec_test_secret";
const encoder = new TextEncoder();

async function sign(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function header(secret: string, timestamp: string, body: string): Promise<string> {
  return `t=${timestamp},v1=${await sign(secret, timestamp, body)}`;
}

describe("verifyStripeSignature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });

  it("verifies a validly signed body", async () => {
    const signatureHeader = await header(SECRET, "1700000000", body);
    expect(await verifyStripeSignature(body, signatureHeader, SECRET)).toBe(true);
  });

  it("rejects a missing signature header", async () => {
    expect(await verifyStripeSignature(body, null, SECRET)).toBe(false);
  });

  it("rejects a malformed signature header", async () => {
    expect(await verifyStripeSignature(body, "not-a-valid-header", SECRET)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const signatureHeader = await header("whsec_other_secret", "1700000000", body);
    expect(await verifyStripeSignature(body, signatureHeader, SECRET)).toBe(false);
  });

  it("rejects a tampered body", async () => {
    const signatureHeader = await header(SECRET, "1700000000", body);
    const tamperedBody = JSON.stringify({ id: "evt_1", type: "invoice.paid", amount: 999999 });
    expect(await verifyStripeSignature(tamperedBody, signatureHeader, SECRET)).toBe(false);
  });
});
