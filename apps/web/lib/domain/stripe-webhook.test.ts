import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseStripeSignatureHeader, verifyStripeSignature } from "./stripe-webhook";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
const TIMESTAMP = "1710504000";

function sign(body: string, secret: string, timestamp: string = TIMESTAMP): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function header(body: string, secret: string = SECRET, timestamp: string = TIMESTAMP): string {
  return `t=${timestamp},v1=${sign(body, secret, timestamp)}`;
}

describe("parseStripeSignatureHeader", () => {
  it("extracts the timestamp and every v1 signature", () => {
    const parsed = parseStripeSignatureHeader("t=123,v1=aaa,v0=zzz,v1=bbb");
    expect(parsed).toEqual({ timestamp: "123", v1Signatures: ["aaa", "bbb"] });
  });

  it("returns null without a timestamp or without any v1 signature", () => {
    expect(parseStripeSignatureHeader("v1=aaa")).toBeNull();
    expect(parseStripeSignatureHeader("t=123,v0=zzz")).toBeNull();
    expect(parseStripeSignatureHeader("garbage")).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  it("accepts a payload signed with the secret", () => {
    expect(verifyStripeSignature(BODY, header(BODY), SECRET)).toBe(true);
  });

  it("accepts a header carrying extra schemes next to a valid v1", () => {
    const mixed = `t=${TIMESTAMP},v0=deadbeef,v1=${sign(BODY, SECRET)}`;
    expect(verifyStripeSignature(BODY, mixed, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyStripeSignature(`${BODY} `, header(BODY), SECRET)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyStripeSignature(BODY, header(BODY, "whsec_other"), SECRET)).toBe(false);
  });

  it("rejects a header whose timestamp was altered after signing", () => {
    const tampered = `t=1710504999,v1=${sign(BODY, SECRET)}`;
    expect(verifyStripeSignature(BODY, tampered, SECRET)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyStripeSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyStripeSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyStripeSignature(BODY, "t=123", SECRET)).toBe(false);
    expect(verifyStripeSignature(BODY, "not-a-signature-header", SECRET)).toBe(false);
  });

  it("rejects when the secret is empty", () => {
    expect(verifyStripeSignature(BODY, header(BODY), "")).toBe(false);
  });
});
