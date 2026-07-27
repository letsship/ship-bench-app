import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseStripeEvent, stripeEventSchema, verifyStripeSignature } from "./stripe-webhook";

const SECRET = "whsec_test_secret";

function sign(rawBody: string, secret: string, timestamp = "1700000000"): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyStripeSignature", () => {
  it("accepts a correctly-signed payload", () => {
    const rawBody = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const header = sign(rawBody, SECRET);
    expect(verifyStripeSignature(rawBody, header, SECRET)).toBe(true);
  });

  it("rejects a missing header", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    expect(verifyStripeSignature(rawBody, null, SECRET)).toBe(false);
  });

  it("rejects a malformed header", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    expect(verifyStripeSignature(rawBody, "not-a-valid-header", SECRET)).toBe(false);
  });

  it("rejects a header missing the v1 signature", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    expect(verifyStripeSignature(rawBody, "t=1700000000", SECRET)).toBe(false);
  });

  it("rejects a wrong signature", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const header = sign(rawBody, "a-different-secret");
    expect(verifyStripeSignature(rawBody, header, SECRET)).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const rawBody = JSON.stringify({ id: "evt_1", amount: 100 });
    const header = sign(rawBody, SECRET);
    const tamperedBody = JSON.stringify({ id: "evt_1", amount: 999 });
    expect(verifyStripeSignature(tamperedBody, header, SECRET)).toBe(false);
  });

  it("rejects an empty secret", () => {
    const rawBody = JSON.stringify({ id: "evt_1" });
    const header = sign(rawBody, SECRET);
    expect(verifyStripeSignature(rawBody, header, "")).toBe(false);
  });
});

describe("parseStripeEvent", () => {
  it("extracts id, type, and invoice_id from metadata", () => {
    const rawBody = JSON.stringify({
      id: "evt_1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_123" } } },
    });
    expect(parseStripeEvent(rawBody)).toEqual({
      id: "evt_1",
      type: "invoice.paid",
      invoiceId: "inv_123",
    });
  });

  it("defaults invoiceId to null when metadata has no invoice_id", () => {
    const rawBody = JSON.stringify({
      id: "evt_1",
      type: "customer.created",
      data: { object: { metadata: {} } },
    });
    expect(parseStripeEvent(rawBody).invoiceId).toBeNull();
  });

  it("throws on non-JSON input", () => {
    expect(() => parseStripeEvent("not json")).toThrow();
  });

  it("throws when required shape is violated", () => {
    const rawBody = JSON.stringify({ type: "invoice.paid", data: { object: {} } });
    expect(() => parseStripeEvent(rawBody)).toThrow();
  });
});

describe("stripeEventSchema", () => {
  it("requires an id, type, and data.object", () => {
    const result = stripeEventSchema.safeParse({
      id: "evt_1",
      type: "invoice.paid",
      data: { object: {} },
    });
    expect(result.success).toBe(true);
  });
});
