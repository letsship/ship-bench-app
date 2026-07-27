import { describe, expect, it } from "vitest";
import { parseStripeEvent, verifyStripeSignature } from "./stripe-webhook";

async function computeTestSignature(
  payload: string,
  timestamp: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const signedContent = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  let hex = "";
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

describe("stripe-webhook domain", () => {
  const testSecret = "whsec_test_secret_123";
  const testPayload = '{"id":"evt_test","type":"invoice.paid"}';
  const testTimestamp = "1234567890";

  it("verifies a valid signature", async () => {
    const testSignature = await computeTestSignature(testPayload, testTimestamp, testSecret);
    const header = `t=${testTimestamp},v1=${testSignature}`;
    const result = await verifyStripeSignature(testPayload, header, testSecret);
    expect(result).toBe(true);
  });

  it("rejects a missing header", async () => {
    const result = await verifyStripeSignature(testPayload, undefined, testSecret);
    expect(result).toBe(false);
  });

  it("rejects a missing secret", async () => {
    const testSignature = await computeTestSignature(testPayload, testTimestamp, testSecret);
    const header = `t=${testTimestamp},v1=${testSignature}`;
    const result = await verifyStripeSignature(testPayload, header, undefined);
    expect(result).toBe(false);
  });

  it("rejects a malformed header (missing v1)", async () => {
    const header = `t=${testTimestamp}`;
    const result = await verifyStripeSignature(testPayload, header, testSecret);
    expect(result).toBe(false);
  });

  it("rejects a wrong-secret signature", async () => {
    const testSignature = await computeTestSignature(testPayload, testTimestamp, testSecret);
    const header = `t=${testTimestamp},v1=${testSignature}`;
    const result = await verifyStripeSignature(testPayload, header, "wrong_secret");
    expect(result).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const testSignature = await computeTestSignature(testPayload, testTimestamp, testSecret);
    const header = `t=${testTimestamp},v1=${testSignature}`;
    const tamperedPayload = '{"id":"evt_test","type":"invoice.paid","tampered":true}';
    const result = await verifyStripeSignature(tamperedPayload, header, testSecret);
    expect(result).toBe(false);
  });

  it("parses a Stripe event", () => {
    const raw =
      '{"id":"evt_123","type":"invoice.paid","data":{"object":{"metadata":{"invoice_id":"inv_456"}}}}';
    const event = parseStripeEvent(raw);
    expect(event.id).toBe("evt_123");
    expect(event.type).toBe("invoice.paid");
    expect(event.data.object.metadata?.invoice_id).toBe("inv_456");
  });

  it("parses an event without metadata", () => {
    const raw = '{"id":"evt_789","type":"charge.succeeded","data":{"object":{}}}';
    const event = parseStripeEvent(raw);
    expect(event.id).toBe("evt_789");
    expect(event.type).toBe("charge.succeeded");
    expect(event.data.object.metadata).toBeUndefined();
  });
});
