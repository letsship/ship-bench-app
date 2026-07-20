import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./verify";

// Helper: compute HMAC-SHA256 signature for testing
async function computeSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SECRET = "whsec_test_secret";
const TIMESTAMP = "1234567890";
const NOW_MS = TIMESTAMP.length === 10 ? parseInt(TIMESTAMP, 10) * 1000 : 0;

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed payload", async () => {
    const payload = '{"id":"evt_test"}';
    const message = `${TIMESTAMP}.${payload}`;
    const signature = await computeSignature(message, SECRET);
    const header = `t=${TIMESTAMP},v1=${signature}`;

    const result = await verifyStripeSignature({
      payload,
      header,
      secret: SECRET,
      nowMs: NOW_MS,
    });

    expect(result).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const payload = '{"id":"evt_test"}';
    const message = `${TIMESTAMP}.${payload}`;
    const signature = await computeSignature(message, SECRET);
    const header = `t=${TIMESTAMP},v1=${signature}`;

    const tamperedPayload = '{"id":"evt_different"}';
    const result = await verifyStripeSignature({
      payload: tamperedPayload,
      header,
      secret: SECRET,
      nowMs: NOW_MS,
    });

    expect(result).toBe(false);
  });

  it("rejects an invalid signature", async () => {
    const payload = '{"id":"evt_test"}';
    const header = `t=${TIMESTAMP},v1=invalidsignature`;

    const result = await verifyStripeSignature({
      payload,
      header,
      secret: SECRET,
      nowMs: NOW_MS,
    });

    expect(result).toBe(false);
  });

  it("rejects a missing Stripe-Signature header", async () => {
    const payload = '{"id":"evt_test"}';

    const result = await verifyStripeSignature({
      payload,
      header: null,
      secret: SECRET,
      nowMs: NOW_MS,
    });

    expect(result).toBe(false);
  });

  it("rejects a malformed header without t= field", async () => {
    const payload = '{"id":"evt_test"}';
    const message = `${TIMESTAMP}.${payload}`;
    const signature = await computeSignature(message, SECRET);
    const header = `v1=${signature}`;

    const result = await verifyStripeSignature({
      payload,
      header,
      secret: SECRET,
      nowMs: NOW_MS,
    });

    expect(result).toBe(false);
  });

  it("rejects a timestamp outside tolerance", async () => {
    const payload = '{"id":"evt_test"}';
    const message = `${TIMESTAMP}.${payload}`;
    const signature = await computeSignature(message, SECRET);
    const header = `t=${TIMESTAMP},v1=${signature}`;

    // Current time is 400 seconds ahead (outside 300s tolerance)
    const futureMs = NOW_MS + 400 * 1000;
    const result = await verifyStripeSignature({
      payload,
      header,
      secret: SECRET,
      toleranceSeconds: 300,
      nowMs: futureMs,
    });

    expect(result).toBe(false);
  });

  it("accepts a timestamp within tolerance", async () => {
    const payload = '{"id":"evt_test"}';
    const message = `${TIMESTAMP}.${payload}`;
    const signature = await computeSignature(message, SECRET);
    const header = `t=${TIMESTAMP},v1=${signature}`;

    // Current time is 200 seconds ahead (within 300s tolerance)
    const futureMs = NOW_MS + 200 * 1000;
    const result = await verifyStripeSignature({
      payload,
      header,
      secret: SECRET,
      toleranceSeconds: 300,
      nowMs: futureMs,
    });

    expect(result).toBe(true);
  });
});
