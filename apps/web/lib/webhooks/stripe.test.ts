import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InvalidStripeWebhookError, verifyStripeWebhook } from "./stripe";

const SECRET = "whsec_test_secret";
const TIMESTAMP = "1700000000";
const body = JSON.stringify({
  id: "evt_123",
  type: "invoice.paid",
  data: { object: { metadata: { invoice_id: "inv_123" } } },
});

function signatureFor(rawBody: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${TIMESTAMP}.${rawBody}`).digest("hex");
}

function signatureHeader(rawBody = body): string {
  return `t=${TIMESTAMP},v1=${signatureFor(rawBody)}`;
}

describe("verifyStripeWebhook", () => {
  it("verifies and parses a valid Stripe event", () => {
    expect(verifyStripeWebhook(body, signatureHeader(), SECRET)).toEqual({
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_123" } } },
    });
  });

  it("rejects a missing Stripe-Signature header", () => {
    expect(() => verifyStripeWebhook(body, null, SECRET)).toThrow(InvalidStripeWebhookError);
  });

  it("rejects an invalid signature", () => {
    expect(() => verifyStripeWebhook(body, `t=${TIMESTAMP},v1=${"0".repeat(64)}`, SECRET)).toThrow(
      InvalidStripeWebhookError,
    );
  });

  it("rejects a body tampered after signing", () => {
    expect(() => verifyStripeWebhook(`${body} `, signatureHeader(), SECRET)).toThrow(
      InvalidStripeWebhookError,
    );
  });
});
