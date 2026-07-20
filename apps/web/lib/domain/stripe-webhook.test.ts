import { describe, expect, it } from "vitest";
import { verifyStripeWebhook } from "./stripe-webhook";

const encoder = new TextEncoder();

async function computeSignature(timestamp: string, body: string, secret: string): Promise<string> {
  const signedContent = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("verifyStripeWebhook", () => {
  const testSecret = "whsec_test_secret";
  const testTimestamp = "1234567890";
  const testBody = JSON.stringify({ id: "evt_test", type: "invoice.paid", data: { object: {} } });

  it("verifies a correctly signed webhook", async () => {
    const sig = await computeSignature(testTimestamp, testBody, testSecret);
    const header = `t=${testTimestamp},v1=${sig}`;
    const event = await verifyStripeWebhook(testBody, header, testSecret);
    expect(event.id).toBe("evt_test");
    expect(event.type).toBe("invoice.paid");
  });

  it("rejects a missing Stripe-Signature header", async () => {
    await expect(() => verifyStripeWebhook(testBody, null, testSecret)).rejects.toThrow(
      "Missing Stripe-Signature header",
    );
  });

  it("rejects a malformed header (missing t or v1)", async () => {
    await expect(() => verifyStripeWebhook(testBody, "v1=abc", testSecret)).rejects.toThrow(
      "Malformed Stripe-Signature header",
    );
  });

  it("rejects a mismatched signature", async () => {
    const header = `t=${testTimestamp},v1=wrongsignature123456789012345678`;
    await expect(() => verifyStripeWebhook(testBody, header, testSecret)).rejects.toThrow(
      "Invalid Stripe signature",
    );
  });

  it("rejects a tampered body", async () => {
    const sig = await computeSignature(testTimestamp, testBody, testSecret);
    const header = `t=${testTimestamp},v1=${sig}`;
    const tamperedBody = JSON.stringify({
      id: "evt_tampered",
      type: "invoice.paid",
      data: { object: {} },
    });
    await expect(() => verifyStripeWebhook(tamperedBody, header, testSecret)).rejects.toThrow(
      "Invalid Stripe signature",
    );
  });

  it("rejects invalid JSON", async () => {
    const invalidBody = "not valid json";
    const sig = await computeSignature(testTimestamp, invalidBody, testSecret);
    const header = `t=${testTimestamp},v1=${sig}`;
    await expect(() => verifyStripeWebhook(invalidBody, header, testSecret)).rejects.toThrow(
      "Invalid JSON in webhook body",
    );
  });
});
