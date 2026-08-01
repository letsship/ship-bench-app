import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe webhook signature verification (https://docs.stripe.com/webhooks).
// The `Stripe-Signature` header carries a timestamp and one or more signature
// schemes, e.g. "t=1712000000,v1=<hex>,v0=<hex>". A v1 signature is the
// HMAC-SHA256 of "<timestamp>.<raw body>" keyed by the endpoint's signing
// secret. Pure string/crypto work — no framework, database, or request
// concerns.

export interface ParsedStripeSignature {
  timestamp: string;
  v1Signatures: string[];
}

export function parseStripeSignatureHeader(header: string): ParsedStripeSignature | null {
  const pairs = header.split(",").map((part) => part.trim().split("="));
  const timestamp = pairs.find(([key]) => key === "t")?.[1];
  const v1Signatures = pairs
    .filter(([key, value]) => key === "v1" && Boolean(value))
    .map(([, value]) => value);
  if (!timestamp || v1Signatures.length === 0) return null;
  return { timestamp, v1Signatures };
}

// Constant-time comparison of two hex digests; length mismatch short-circuits
// (the length of a valid digest is public knowledge, not a secret).
function signaturesMatch(expected: string, candidate: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const candidateBytes = Buffer.from(candidate);
  if (expectedBytes.length !== candidateBytes.length) return false;
  return timingSafeEqual(expectedBytes, candidateBytes);
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) return false;
  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");
  return parsed.v1Signatures.some((candidate) => signaturesMatch(expected, candidate));
}
