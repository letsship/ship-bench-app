import { describe, expect, it } from "vitest";
import { stripeEventType, stripeInvoiceId, verifyStripeSignature } from "./stripe-webhook";

const SECRET = "whsec_test_secret";

// Mirrors the verifier's own HMAC so the test is hermetic (no `stripe` package,
// no network): it generates a genuine Stripe-style signature.
async function sign(payload: string, secret: string, timestamp = "1700000000"): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

describe("verifyStripeSignature", () => {
  it("returns true for a signature produced with the correct secret", async () => {
    const payload = '{"id":"evt_1","type":"invoice.paid"}';
    const header = await sign(payload, SECRET);
    await expect(verifyStripeSignature(payload, header, SECRET)).resolves.toBe(true);
  });

  it("returns false for a tampered payload", async () => {
    const header = await sign('{"id":"evt_1","type":"invoice.paid"}', SECRET);
    await expect(
      verifyStripeSignature('{"id":"evt_1","type":"refund.created"}', header, SECRET),
    ).resolves.toBe(false);
  });

  it("returns false for a wrong secret", async () => {
    const payload = '{"id":"evt_1"}';
    const header = await sign(payload, "whsec_other");
    await expect(verifyStripeSignature(payload, header, SECRET)).resolves.toBe(false);
  });

  it("returns false for a missing header", async () => {
    await expect(verifyStripeSignature("{}", null, SECRET)).resolves.toBe(false);
    await expect(verifyStripeSignature("{}", undefined, SECRET)).resolves.toBe(false);
  });

  it("returns false for a malformed header", async () => {
    await expect(verifyStripeSignature("{}", "not-a-stripe-signature", SECRET)).resolves.toBe(false);
    await expect(verifyStripeSignature("{}", "t=1700000000,v1=nothex", SECRET)).resolves.toBe(false);
  });
});

describe("stripe event parsers", () => {
  it("reads type and metadata.invoice_id", () => {
    const event = {
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_123" } } },
    };
    expect(stripeEventType(event)).toBe("invoice.paid");
    expect(stripeInvoiceId(event)).toBe("inv_123");
  });

  it("returns null when fields are absent or non-string", () => {
    expect(stripeEventType({})).toBeNull();
    expect(stripeInvoiceId({})).toBeNull();
    expect(stripeInvoiceId({ data: { object: { metadata: { invoice_id: 9 } } } })).toBeNull();
  });
});
