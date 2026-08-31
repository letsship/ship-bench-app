// Pure, framework-free Stripe webhook signature verification. Mirrors the Web
// Crypto approach in lib/auth/session.ts so it runs identically in Node and on
// Cloudflare Workers (no node:crypto, no stripe SDK). The signing secret is a
// parameter (DI) so tests are deterministic.
//
// Stripe's Stripe-Signature header looks like:  t=<unix-ts>,v1=<hex-sha256-hmac>
// The signed payload is  "<t>.<rawRequestBody>"  and the HMAC is computed with
// the webhook signing secret. See https://docs.stripe.com/webhooks#verify-events.

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(new Uint8Array(signature));
}

interface ParsedHeader {
  timestamp: string | null;
  v1: string | null;
}

// Parse "t=123,v1=abc" into its parts. Stripe separates claims with commas and
// joins key/value with '='. Unknown claims are ignored.
function parseHeader(header: string): ParsedHeader {
  const parsed: ParsedHeader = { timestamp: null, v1: null };
  for (const part of header.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals);
    const value = trimmed.slice(equals + 1);
    if (key === "t") parsed.timestamp = value;
    else if (key === "v1") parsed.v1 = value;
  }
  return parsed;
}

// Verify a Stripe-Signature header against the raw request body. Returns true
// only when both the timestamp (t) and the v1 signature are present and the
// recomputed HMAC matches v1. No timestamp-age tolerance is enforced (Stripe's
// reference verifier makes it optional) so tests stay clock-independent.
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const { timestamp, v1 } = parseHeader(header);
  if (!timestamp || !v1) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return timingSafeEqual(expected, v1);
}

// Test-only helper: produce the v1 signature Stripe would send for a body, so
// tests can build a valid Stripe-Signature header without depending on Stripe.
export async function signStripePayload(
  secret: string,
  timestamp: string,
  rawBody: string,
): Promise<string> {
  return hmacHex(secret, `${timestamp}.${rawBody}`);
}

export function buildStripeSignatureHeader(timestamp: string, signature: string): string {
  return `t=${timestamp},v1=${signature}`;
}
