import { createHmac, timingSafeEqual } from "node:crypto";

export function constructStripeEvent(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): unknown {
  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header");
  }

  const parts = signatureHeader.split(",");
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid Stripe-Signature header format");
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest();

  for (const sig of signatures) {
    const actual = Buffer.from(sig, "hex");
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      return JSON.parse(payload);
    }
  }

  throw new Error("Stripe signature verification failed");
}