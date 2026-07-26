import { describe, expect, it } from "vitest";
import { parseSignatureHeader, verifyStripeSignature } from "./stripe-signature";

const SECRET = "whsec_test_secret";
const PAYLOAD = JSON.stringify({ id: "evt_1", type: "invoice.paid" });

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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
  return `t=${timestamp},v1=${toHex(new Uint8Array(signature))}`;
}

describe("parseSignatureHeader", () => {
  it("parses a well-formed header", () => {
    expect(parseSignatureHeader("t=1614556800,v1=abc,v1=def")).toEqual({
      timestamp: 1614556800,
      v1: ["abc", "def"],
    });
  });

  it("returns null for a missing header", () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader(undefined)).toBeNull();
  });

  it("returns null when the timestamp is missing", () => {
    expect(parseSignatureHeader("v1=abc")).toBeNull();
  });

  it("returns null when no v1 value is present", () => {
    expect(parseSignatureHeader("t=1614556800")).toBeNull();
  });

  it("returns null for a malformed header", () => {
    expect(parseSignatureHeader("garbage")).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  it("verifies a payload signed with the known secret", async () => {
    const header = await signHeader(PAYLOAD, SECRET, 1614556800);
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const header = await signHeader(PAYLOAD, SECRET, 1614556800);
    const tampered = JSON.stringify({ id: "evt_1", type: "invoice.void" });
    expect(await verifyStripeSignature(tampered, header, SECRET)).toBe(false);
  });

  it("rejects a wrong v1 value", async () => {
    expect(await verifyStripeSignature(PAYLOAD, "t=1614556800,v1=deadbeef", SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    const header = await signHeader(PAYLOAD, "whsec_other_secret", 1614556800);
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET)).toBe(false);
  });

  it("rejects a missing header", async () => {
    expect(await verifyStripeSignature(PAYLOAD, null, SECRET)).toBe(false);
  });

  it("rejects a malformed header", async () => {
    expect(await verifyStripeSignature(PAYLOAD, "not-a-header", SECRET)).toBe(false);
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const now = new Date("2021-03-01T00:00:00.000Z");
    const staleTimestamp = Math.floor(now.getTime() / 1000) - 600;
    const header = await signHeader(PAYLOAD, SECRET, staleTimestamp);
    expect(
      await verifyStripeSignature(PAYLOAD, header, SECRET, { now, toleranceSeconds: 300 }),
    ).toBe(false);
  });

  it("accepts a timestamp inside the tolerance window", async () => {
    const now = new Date("2021-03-01T00:00:00.000Z");
    const recentTimestamp = Math.floor(now.getTime() / 1000) - 60;
    const header = await signHeader(PAYLOAD, SECRET, recentTimestamp);
    expect(
      await verifyStripeSignature(PAYLOAD, header, SECRET, { now, toleranceSeconds: 300 }),
    ).toBe(true);
  });
});
