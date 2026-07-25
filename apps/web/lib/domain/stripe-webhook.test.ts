import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-webhook";

const encoder = new TextEncoder();

async function createSignature(t: number, payload: string, secret: string): Promise<string> {
  const signedContent = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  let hex = "";
  for (const byte of new Uint8Array(signature)) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

describe("verifyStripeSignature", () => {
  const secret = "test-webhook-secret";
  const payload = '{"id":"evt_1","type":"invoice.paid"}';
  const nowMs = 1000000000;

  it("accepts a correctly signed payload", async () => {
    const t = Math.floor(nowMs / 1000);
    const v1 = await createSignature(t, payload, secret);
    const header = `t=${t},v1=${v1}`;
    const result = await verifyStripeSignature(payload, header, secret, nowMs);
    expect(result).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const t = Math.floor(nowMs / 1000);
    const v1 = await createSignature(t, payload, secret);
    const header = `t=${t},v1=${v1}`;
    const tamperedPayload = '{"id":"evt_2","type":"invoice.paid"}';
    const result = await verifyStripeSignature(tamperedPayload, header, secret, nowMs);
    expect(result).toBe(false);
  });

  it("rejects a wrong v1 signature", async () => {
    const t = Math.floor(nowMs / 1000);
    const header = `t=${t},v1=wrong`;
    const result = await verifyStripeSignature(payload, header, secret, nowMs);
    expect(result).toBe(false);
  });

  it("rejects an absent v1", async () => {
    const t = Math.floor(nowMs / 1000);
    const header = `t=${t}`;
    const result = await verifyStripeSignature(payload, header, secret, nowMs);
    expect(result).toBe(false);
  });

  it("rejects a signature from the wrong secret", async () => {
    const t = Math.floor(nowMs / 1000);
    const v1 = await createSignature(t, payload, "wrong-secret");
    const header = `t=${t},v1=${v1}`;
    const result = await verifyStripeSignature(payload, header, secret, nowMs);
    expect(result).toBe(false);
  });

  it("rejects a malformed header", async () => {
    const header = "malformed-header";
    const result = await verifyStripeSignature(payload, header, secret, nowMs);
    expect(result).toBe(false);
  });

  it("rejects a missing header", async () => {
    const result = await verifyStripeSignature(payload, "", secret, nowMs);
    expect(result).toBe(false);
  });

  it("rejects a timestamp outside tolerance", async () => {
    const t = Math.floor((nowMs - 400000) / 1000);
    const v1 = await createSignature(t, payload, secret);
    const header = `t=${t},v1=${v1}`;
    const result = await verifyStripeSignature(payload, header, secret, nowMs, 300);
    expect(result).toBe(false);
  });

  it("accepts a timestamp within tolerance", async () => {
    const t = Math.floor((nowMs - 100000) / 1000);
    const v1 = await createSignature(t, payload, secret);
    const header = `t=${t},v1=${v1}`;
    const result = await verifyStripeSignature(payload, header, secret, nowMs, 300);
    expect(result).toBe(true);
  });

  it("rejects a negative timestamp age", async () => {
    const t = Math.floor((nowMs + 100000) / 1000);
    const v1 = await createSignature(t, payload, secret);
    const header = `t=${t},v1=${v1}`;
    const result = await verifyStripeSignature(payload, header, secret, nowMs, 300);
    expect(result).toBe(false);
  });

  it("rejects a non-numeric timestamp", async () => {
    const header = "t=not-a-number,v1=sig";
    const result = await verifyStripeSignature(payload, header, secret, nowMs);
    expect(result).toBe(false);
  });
});
