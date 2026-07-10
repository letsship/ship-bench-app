// Stripe webhook signature verification (Stripe's "signing secret" scheme:
// https://docs.stripe.com/webhooks#verify-events). Pure and framework-free —
// uses Web Crypto (crypto.subtle) rather than Node's `crypto`, mirroring
// lib/auth/session.ts's HMAC pattern, since the app deploys to Cloudflare
// Workers via OpenNext.

const encoder = new TextEncoder();

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  const items = header.split(",").map((part) => part.trim());
  const timestamp = items.find((item) => item.startsWith("t="))?.slice(2);
  const signatures = items.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(signature);
}

// Verifies a raw request body against Stripe's `Stripe-Signature` header:
// parses `t=<timestamp>,v1=<sig>[,v1=<sig>...]`, recomputes HMAC-SHA256 of
// `<timestamp>.<payload>` under the webhook secret, and accepts if it matches
// any of the v1 signatures present.
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;
  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${payload}`);
  return parsed.signatures.some((signature) => timingSafeEqual(signature, expected));
}
