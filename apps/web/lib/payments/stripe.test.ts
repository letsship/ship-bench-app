import { describe, expect, it } from "vitest";
import {
  constructStripeEvent,
  StripeSignatureError,
  verifyStripeSignature,
} from "./stripe";

const encoder = new TextEncoder();
const SECRET = "whsec_test_secret";
const TIMESTAMP = "1770000000";

async function sign(rawBody: string, secret = SECRET): Promise<string> {
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
    encoder.encode(`${TIMESTAMP}.${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `t=${TIMESTAMP},v1=${hex}`;
}

describe("Stripe webhook signatures", () => {
  const event = {
    id: "evt_paid",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: "invoice-1" } } },
  };
  const rawBody = JSON.stringify(event);

  it("verifies a correctly signed body and constructs its event", async () => {
    const signature = await sign(rawBody);
    await expect(verifyStripeSignature(rawBody, signature, SECRET)).resolves.toBeUndefined();
    await expect(constructStripeEvent(rawBody, signature, SECRET)).resolves.toEqual(event);
  });

  it("rejects a missing signature header", async () => {
    await expect(verifyStripeSignature(rawBody, null, SECRET)).rejects.toBeInstanceOf(
      StripeSignatureError,
    );
  });

  it("rejects a malformed signature header", async () => {
    await expect(verifyStripeSignature(rawBody, "v1=abc", SECRET)).rejects.toBeInstanceOf(
      StripeSignatureError,
    );
  });

  it("rejects a signature created with the wrong secret", async () => {
    await expect(
      verifyStripeSignature(rawBody, await sign(rawBody, "wrong-secret"), SECRET),
    ).rejects.toBeInstanceOf(StripeSignatureError);
  });

  it("rejects a body changed after signing", async () => {
    const signature = await sign(rawBody);
    await expect(
      verifyStripeSignature(`${rawBody} `, signature, SECRET),
    ).rejects.toBeInstanceOf(StripeSignatureError);
  });
});
