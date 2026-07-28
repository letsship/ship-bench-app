// Pure business rules for the Stripe webhook — just the HMAC verification with
// an injectable clock so tests are hermetic.

import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-webhook";

// Build a real Stripe-like signature for a given payload at a given timestamp.
// We use the same Web Crypto recipe that verifyStripeSignature uses, so that
// the test fixture is independently computed.
async function sign(
  payload: string,
  secret: string,
  timestamp: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hmac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(hmac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

const SECRET = "whsec_test_secret_key_12345";
const BODY = JSON.stringify({
  id: "evt_123",
  type: "invoice.paid",
  data: { object: { metadata: { invoice_id: "inv_001" } } },
});
const TIMESTAMP = 1_700_000_000;

describe("verifyStripeSignature", () => {
  it("passes a correctly signed request", async () => {
    const header = await sign(BODY, SECRET, TIMESTAMP);
    await expect(
      verifyStripeSignature(BODY, header, SECRET, { nowSeconds: TIMESTAMP, toleranceSeconds: 300 }),
    ).resolves.toBe(true);
  });

  it("rejects a missing header", async () => {
    await expect(
      verifyStripeSignature(BODY, null, SECRET, { nowSeconds: TIMESTAMP }),
    ).resolves.toBe(false);
  });

  it("rejects an empty header", async () => {
    await expect(
      verifyStripeSignature(BODY, "", SECRET, { nowSeconds: TIMESTAMP }),
    ).resolves.toBe(false);
  });

  it("rejects a tampered body (HMAC mismatch)", async () => {
    const header = await sign(BODY, SECRET, TIMESTAMP);
    const tampered = BODY.replace("inv_001", "inv_999");
    await expect(
      verifyStripeSignature(tampered, header, SECRET, { nowSeconds: TIMESTAMP }),
    ).resolves.toBe(false);
  });

  it("rejects a wrong secret", async () => {
    const header = await sign(BODY, "whsec_different_secret", TIMESTAMP);
    await expect(
      verifyStripeSignature(BODY, header, SECRET, { nowSeconds: TIMESTAMP }),
    ).resolves.toBe(false);
  });

  it("rejects a stale timestamp beyond tolerance", async () => {
    const header = await sign(BODY, SECRET, TIMESTAMP - 600);
    await expect(
      verifyStripeSignature(BODY, header, SECRET, { nowSeconds: TIMESTAMP, toleranceSeconds: 300 }),
    ).resolves.toBe(false);
  });

  it("accepts a timestamp within tolerance", async () => {
    const header = await sign(BODY, SECRET, TIMESTAMP - 120);
    await expect(
      verifyStripeSignature(BODY, header, SECRET, { nowSeconds: TIMESTAMP, toleranceSeconds: 300 }),
    ).resolves.toBe(true);
  });

  it("rejects a malformed header (no timestamp)", async () => {
    const header = "v1=abcdef1234";
    await expect(
      verifyStripeSignature(BODY, header, SECRET, { nowSeconds: TIMESTAMP }),
    ).resolves.toBe(false);
  });

  it("accepts a header with multiple v1 values (one matches)", async () => {
    const goodSig = await sign(BODY, SECRET, TIMESTAMP);
    const header = `t=${TIMESTAMP},v1=deadbeef,${goodSig.split(",").slice(1).join(",")}`;
    await expect(
      verifyStripeSignature(BODY, header, SECRET, { nowSeconds: TIMESTAMP }),
    ).resolves.toBe(true);
  });

  it("rejects when no secret is provided", async () => {
    await expect(
      verifyStripeSignature(BODY, "t=1,v1=x", "", { nowSeconds: TIMESTAMP }),
    ).resolves.toBe(false);
  });

  it("rejects when rawBody is empty", async () => {
    await expect(
      verifyStripeSignature("", "t=1,v1=x", SECRET, { nowSeconds: TIMESTAMP }),
    ).resolves.toBe(false);
  });
});