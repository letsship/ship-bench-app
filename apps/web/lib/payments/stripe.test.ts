import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe";

const SECRET = "whsec_test_secret";
const encoder = new TextEncoder();

async function signHeader(payload: string, secret: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

describe("verifyStripeSignature", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
  const now = Date.parse("2026-03-15T12:00:00.000Z");

  it("accepts a correctly-signed payload", async () => {
    const header = await signHeader(payload, SECRET, Math.floor(now / 1000));
    expect(await verifyStripeSignature(payload, header, SECRET, now)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const header = await signHeader(payload, SECRET, Math.floor(now / 1000));
    const tampered = JSON.stringify({ id: "evt_1", type: "invoice.voided" });
    expect(await verifyStripeSignature(tampered, header, SECRET, now)).toBe(false);
  });

  it("rejects a missing signature header", async () => {
    expect(await verifyStripeSignature(payload, null, SECRET, now)).toBe(false);
  });

  it("rejects a malformed signature header", async () => {
    expect(await verifyStripeSignature(payload, "not-a-valid-header", SECRET, now)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const header = await signHeader(payload, "whsec_other_secret", Math.floor(now / 1000));
    expect(await verifyStripeSignature(payload, header, SECRET, now)).toBe(false);
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const staleTimestamp = Math.floor(now / 1000) - 10 * 60;
    const header = await signHeader(payload, SECRET, staleTimestamp);
    expect(await verifyStripeSignature(payload, header, SECRET, now)).toBe(false);
  });
});
