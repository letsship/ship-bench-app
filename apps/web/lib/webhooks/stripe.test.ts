import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe";

const encoder = new TextEncoder();

async function sign(secret: string, timestamp: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ id: "evt_1", type: "invoice.paid" });

describe("verifyStripeSignature", () => {
  it("accepts a signature computed with the same secret", async () => {
    const timestamp = "1700000000";
    const signature = await sign(SECRET, timestamp, BODY);
    const header = `t=${timestamp},v1=${signature}`;
    expect(await verifyStripeSignature(BODY, header, SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const timestamp = "1700000000";
    const signature = await sign("whsec_other_secret", timestamp, BODY);
    const header = `t=${timestamp},v1=${signature}`;
    expect(await verifyStripeSignature(BODY, header, SECRET)).toBe(false);
  });

  it("rejects when the body has been tampered with after signing", async () => {
    const timestamp = "1700000000";
    const signature = await sign(SECRET, timestamp, BODY);
    const header = `t=${timestamp},v1=${signature}`;
    const tampered = JSON.stringify({ id: "evt_1", type: "invoice.voided" });
    expect(await verifyStripeSignature(tampered, header, SECRET)).toBe(false);
  });

  it("rejects a malformed header", async () => {
    expect(await verifyStripeSignature(BODY, "not-a-valid-header", SECRET)).toBe(false);
    expect(await verifyStripeSignature(BODY, "t=1700000000", SECRET)).toBe(false);
    expect(await verifyStripeSignature(BODY, "v1=abc123", SECRET)).toBe(false);
  });

  it("rejects a missing header", async () => {
    expect(await verifyStripeSignature(BODY, null, SECRET)).toBe(false);
  });
});
