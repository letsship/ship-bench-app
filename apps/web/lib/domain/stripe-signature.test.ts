import { describe, expect, it } from "vitest";
import { signStripePayload, verifyStripeSignature } from "./stripe-signature";

describe("Stripe signature verification", () => {
  const secret = "whsec_test_secret";
  const payload = '{"id":"evt_test","type":"invoice.paid","data":{"object":{"id":"in_test"}}}';
  const timestamp = 1234567890;

  it("verifies a valid signature produced by signStripePayload", async () => {
    const header = await signStripePayload({ payload, secret, timestampSeconds: timestamp });
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret,
      nowSeconds: timestamp + 10,
    });
    expect(isValid).toBe(true);
  });

  it("rejects a signature with wrong secret", async () => {
    const header = await signStripePayload({ payload, secret, timestampSeconds: timestamp });
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret: "wrong_secret",
      nowSeconds: timestamp + 10,
    });
    expect(isValid).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const header = await signStripePayload({ payload, secret, timestampSeconds: timestamp });
    const tamperedPayload = payload.replace("invoice.paid", "charge.refunded");
    const isValid = await verifyStripeSignature({
      payload: tamperedPayload,
      header,
      secret,
      nowSeconds: timestamp + 10,
    });
    expect(isValid).toBe(false);
  });

  it("rejects a malformed header missing t", async () => {
    const header = "v1=abc123";
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret,
      nowSeconds: timestamp + 10,
    });
    expect(isValid).toBe(false);
  });

  it("rejects a malformed header missing v1", async () => {
    const header = `t=${timestamp}`;
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret,
      nowSeconds: timestamp + 10,
    });
    expect(isValid).toBe(false);
  });

  it("rejects a timestamp outside tolerance window (too old)", async () => {
    const header = await signStripePayload({ payload, secret, timestampSeconds: timestamp });
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret,
      toleranceSeconds: 300,
      nowSeconds: timestamp + 400, // 400 seconds later, beyond default 300s tolerance
    });
    expect(isValid).toBe(false);
  });

  it("accepts a timestamp at the edge of tolerance (300s)", async () => {
    const header = await signStripePayload({ payload, secret, timestampSeconds: timestamp });
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret,
      toleranceSeconds: 300,
      nowSeconds: timestamp + 300, // exactly at boundary
    });
    expect(isValid).toBe(true);
  });

  it("accepts a timestamp within tolerance", async () => {
    const header = await signStripePayload({ payload, secret, timestampSeconds: timestamp });
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret,
      toleranceSeconds: 300,
      nowSeconds: timestamp + 150,
    });
    expect(isValid).toBe(true);
  });

  it("rejects a future timestamp (negative age)", async () => {
    const header = await signStripePayload({ payload, secret, timestampSeconds: timestamp });
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret,
      toleranceSeconds: 300,
      nowSeconds: timestamp - 10,
    });
    expect(isValid).toBe(false);
  });

  it("accepts a valid v1 among multiple comma-separated signatures", async () => {
    const v1Signature = await signStripePayload({ payload, secret, timestampSeconds: timestamp });
    // Simulate an older v0 signature alongside the new v1
    const header = `t=${timestamp},v0=oldsig123,${v1Signature.split(",")[1]}`;
    const isValid = await verifyStripeSignature({
      payload,
      header,
      secret,
      nowSeconds: timestamp + 10,
    });
    expect(isValid).toBe(true);
  });
});
