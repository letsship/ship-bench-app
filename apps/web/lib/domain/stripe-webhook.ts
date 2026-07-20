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
  // Note: Stripe can send multiple v1 signatures (e.g., during secret rotation),
  // so we collect all v1 values and check if any matches the computed HMAC.
  let t: string | undefined;
  const v1Values: string[] = [];

  for (const pair of header.split(",")) {
    const [key, value] = pair.trim().split("=");
    if (key === "t" && value) t = value;
    if (key === "v1" && value) v1Values.push(value);
  }

  if (!t || v1Values.length === 0) {
    return false;
  }

  // Compute HMAC-SHA256 over the signed content: ${t}.${payload}
  const signed = `${t}.${payload}`;
  const computed = createHmac("sha256", secret).update(signed).digest("hex");

  // Check if any v1 value matches the computed HMAC (timing-safe per comparison)
  for (const v1 of v1Values) {
    try {
      if (timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(v1, "hex"))) {
        return true;
      }
    } catch {
      // Buffers have different lengths or other error; continue to next v1
      continue;
    }
  }

  return false;
}
