import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-webhook";

const SECRET = "whsec_testsecret";
const PAYLOAD = JSON.stringify({ id: "evt_1", type: "invoice.paid" });

const NOW_MS = Date.parse("2026-03-15T12:00:00.000Z");
const NOW_S = Math.floor(NOW_MS / 1000);

function sign(payload: string, secret: string, timestampSeconds: number): string {
  const v1 = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${payload}`, "utf8")
    .digest("hex");
  return `t=${timestampSeconds},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed payload", () => {
    const header = sign(PAYLOAD, SECRET, NOW_S);
    expect(verifyStripeSignature(PAYLOAD, header, SECRET, { nowMs: NOW_MS })).toBe(true);
  });

  it("accepts a header with extra scheme entries around the v1 signature", () => {
    const v1 = createHmac("sha256", SECRET).update(`${NOW_S}.${PAYLOAD}`, "utf8").digest("hex");
    const header = `t=${NOW_S},v0=deadbeef,v1=${v1}`;
    expect(verifyStripeSignature(PAYLOAD, header, SECRET, { nowMs: NOW_MS })).toBe(true);
  });

  it("rejects a null or missing header", () => {
    expect(verifyStripeSignature(PAYLOAD, null, SECRET, { nowMs: NOW_MS })).toBe(false);
    expect(verifyStripeSignature(PAYLOAD, "", SECRET, { nowMs: NOW_MS })).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const header = sign(PAYLOAD, SECRET, NOW_S);
    const tampered = PAYLOAD.slice(0, -1) + " ";
    expect(verifyStripeSignature(tampered, header, SECRET, { nowMs: NOW_MS })).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const header = sign(PAYLOAD, "whsec_wrongsecret", NOW_S);
    expect(verifyStripeSignature(PAYLOAD, header, SECRET, { nowMs: NOW_MS })).toBe(false);
  });

  it("rejects a malformed header with no t= or no v1=", () => {
    expect(verifyStripeSignature(PAYLOAD, "not-a-signature", SECRET, { nowMs: NOW_MS })).toBe(
      false,
    );
    expect(verifyStripeSignature(PAYLOAD, "v1=abc123", SECRET, { nowMs: NOW_MS })).toBe(false);
    expect(verifyStripeSignature(PAYLOAD, `t=${NOW_S}`, SECRET, { nowMs: NOW_MS })).toBe(false);
    expect(verifyStripeSignature(PAYLOAD, "t=soon,v1=abc", SECRET, { nowMs: NOW_MS })).toBe(false);
  });

  it("rejects a timestamp outside the tolerance window", () => {
    const stale = sign(PAYLOAD, SECRET, NOW_S - 3600);
    expect(verifyStripeSignature(PAYLOAD, stale, SECRET, { nowMs: NOW_MS })).toBe(false);
    const future = sign(PAYLOAD, SECRET, NOW_S + 3600);
    expect(verifyStripeSignature(PAYLOAD, future, SECRET, { nowMs: NOW_MS })).toBe(false);
  });

  it("accepts a timestamp just inside a custom tolerance", () => {
    const header = sign(PAYLOAD, SECRET, NOW_S - 60);
    expect(
      verifyStripeSignature(PAYLOAD, header, SECRET, { nowMs: NOW_MS, toleranceSeconds: 120 }),
    ).toBe(true);
  });
});
