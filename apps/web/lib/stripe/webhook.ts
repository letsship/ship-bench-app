import { HttpError } from "@/lib/http";
import { type StripeWebhookEvent, stripeWebhookEventSchema } from "@/lib/validation";

// Stripe webhook signature verification (https://docs.stripe.com/webhooks#verify-events).
// Framework- and database-free so it can be unit tested in isolation and reused
// from the route handler. Uses Web Crypto (crypto.subtle) so it runs identically
// on Cloudflare Workers and Node.

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

interface ParsedSignatureHeader {
  timestamp: string;
  signatures: string[];
}

function parseSignatureHeader(header: string | null): ParsedSignatureHeader {
  if (!header) throw new HttpError(400, "bad_request", "Missing Stripe-Signature header");
  const parts = header.split(",").map((part) => part.trim());
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t" && value) timestamp = value;
    else if (key === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) {
    throw new HttpError(400, "bad_request", "Malformed Stripe-Signature header");
  }
  return { timestamp, signatures };
}

async function computeSignature(secret: string, signedPayload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  return toHex(signature);
}

// Verifies the Stripe-Signature header against the raw request body, then
// parses and validates the payload. Throws HttpError(400) on any failure.
export async function verifyAndParseStripeEvent(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): Promise<StripeWebhookEvent> {
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  const expected = await computeSignature(secret, `${timestamp}.${payload}`);
  const matches = signatures.some((signature) => timingSafeEqual(signature, expected));
  if (!matches) throw new HttpError(400, "bad_request", "Stripe signature verification failed");

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new HttpError(400, "bad_request", "Invalid Stripe webhook payload");
  }
  return stripeWebhookEventSchema.parse(parsed);
}
