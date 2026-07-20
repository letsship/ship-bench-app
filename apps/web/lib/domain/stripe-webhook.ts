import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe webhook signature verification using Node's built-in crypto module.
// Parse the Stripe-Signature header (comma-separated t=<ts>,v1=<hex> pairs),
// compute HMAC-SHA256 of the signed payload '${t}.${rawBody}' with the secret,
// and compare hex digests with timing-safe comparison.

export interface VerifyOptions {
  payload: string; // raw request body (bytes as string)
  header: string | undefined; // Stripe-Signature header value
  secret: string | undefined; // webhook signing secret
}

export function verifyStripeSignature({ payload, header, secret }: VerifyOptions): boolean {
  if (!header || !secret) {
    return false;
  }

  // Parse the header for t= and v1= fields
  const pairs = header.split(",").reduce(
    (acc, pair) => {
      const [key, value] = pair.trim().split("=");
      if (key && value) acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  const t = pairs.t;
  const v1 = pairs.v1;

  if (!t || !v1) {
    return false;
  }

  // Compute HMAC-SHA256 over the signed content: ${t}.${payload}
  const signed = `${t}.${payload}`;
  const computed = createHmac("sha256", secret).update(signed).digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(v1, "hex"));
  } catch {
    // Buffers have different lengths or other error
    return false;
  }
}
