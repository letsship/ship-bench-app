import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe";

// Helper to compute a valid signature for testing.
async function computeTestSignature(payload: string, secret: string): Promise<string> {
  const timestamp = "1234567890";
  const message = `${timestamp}.${payload}`;

  const secretBytes = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, messageBytes);

  const v1 = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `t=${timestamp},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  it("returns true for a correctly signed payload", async () => {
    const payload = '{"id":"evt_123"}';
    const secret = "whsec_test123";
    const header = await computeTestSignature(payload, secret);

    const result = await verifyStripeSignature(payload, header, secret);
    expect(result).toBe(true);
  });

  it("returns false for a tampered payload", async () => {
    const payload = '{"id":"evt_123"}';
    const secret = "whsec_test123";
    const header = await computeTestSignature(payload, secret);

    // Tamper with the payload.
    const tamperedPayload = '{"id":"evt_456"}';
    const result = await verifyStripeSignature(tamperedPayload, header, secret);
    expect(result).toBe(false);
  });

  it("returns false for a wrong secret", async () => {
    const payload = '{"id":"evt_123"}';
    const secret = "whsec_test123";
    const header = await computeTestSignature(payload, secret);

    const result = await verifyStripeSignature(payload, header, "whsec_wrong");
    expect(result).toBe(false);
  });

  it("returns false for a missing v1 in the header", async () => {
    const payload = '{"id":"evt_123"}';
    const secret = "whsec_test123";
    const header = "t=1234567890"; // Missing v1=...

    const result = await verifyStripeSignature(payload, header, secret);
    expect(result).toBe(false);
  });

  it("returns false for a malformed header", async () => {
    const payload = '{"id":"evt_123"}';
    const secret = "whsec_test123";

    const result = await verifyStripeSignature(payload, "not-a-valid-header", secret);
    expect(result).toBe(false);
  });

  it("returns false for a missing header", async () => {
    const payload = '{"id":"evt_123"}';
    const secret = "whsec_test123";

    const result = await verifyStripeSignature(payload, "", secret);
    expect(result).toBe(false);
  });

  it("returns false when payload is empty", async () => {
    const secret = "whsec_test123";
    const header = await computeTestSignature("any", secret);

    const result = await verifyStripeSignature("", header, secret);
    expect(result).toBe(false);
  });

  it("returns false when secret is empty", async () => {
    const payload = '{"id":"evt_123"}';
    const header = await computeTestSignature(payload, "whsec_test123");

    const result = await verifyStripeSignature(payload, header, "");
    expect(result).toBe(false);
  });
});
