import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { constructStripeEvent } from "./webhook";

const SECRET = "whsec_test_secret_key_123";

function buildHeader(payload: string, timestamp?: number, secret?: string): string {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret ?? SECRET)
    .update(`${t}.${payload}`)
    .digest("hex");
  return `t=${t},v1=${sig}`;
}

describe("constructStripeEvent", () => {
  it("parses a valid signature and returns the parsed body", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const header = buildHeader(payload);
    const result = constructStripeEvent(payload, header, SECRET);
    expect(result).toEqual({ id: "evt_1", type: "invoice.paid" });
  });

  it("throws on a tampered payload", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const header = buildHeader(payload);
    expect(() =>
      constructStripeEvent(
        JSON.stringify({ id: "evt_1", type: "invoice.paid", tampered: true }),
        header,
        SECRET,
      ),
    ).toThrow("Stripe signature verification failed");
  });

  it("throws on an invalid v1 signature", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const header = "t=1234567890,v1=invalidhex";
    expect(() => constructStripeEvent(payload, header, SECRET)).toThrow(
      "Stripe signature verification failed",
    );
  });

  it("throws on missing header", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    expect(() => constructStripeEvent(payload, null, SECRET)).toThrow("Missing Stripe-Signature header");
  });

  it("throws on a malformed header (no v1)", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    expect(() => constructStripeEvent(payload, "t=1234567890", SECRET)).toThrow(
      "Invalid Stripe-Signature header format",
    );
  });

  it("throws on a malformed header (no t)", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    expect(() => constructStripeEvent(payload, "v1=aaaa", SECRET)).toThrow(
      "Invalid Stripe-Signature header format",
    );
  });

  it("accepts the correct v1 when multiple signatures are present", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const t = Math.floor(Date.now() / 1000);
    const validSig = createHmac("sha256", SECRET)
      .update(`${t}.${payload}`)
      .digest("hex");
    const header = `t=${t},v0=old_sig,v1=${validSig}`;
    const result = constructStripeEvent(payload, header, SECRET);
    expect(result).toEqual({ id: "evt_1", type: "invoice.paid" });
  });

  it("throws when signed with a different secret", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const header = buildHeader(payload, undefined, "whsec_wrong_secret");
    expect(() => constructStripeEvent(payload, header, SECRET)).toThrow(
      "Stripe signature verification failed",
    );
  });
});