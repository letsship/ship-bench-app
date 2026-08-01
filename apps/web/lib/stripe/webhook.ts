// Stripe webhook signature verification (https://docs.stripe.com/webhooks#verify-events).
// Stripe signs each delivery with a `Stripe-Signature` header of the form
// `t=<unix-ts>,v1=<hex hmac>` where the HMAC-SHA256 is computed over
// `<t>.<rawBody>` with the endpoint's signing secret. The signing uses Web
// Crypto (like lib/auth/session.ts) so it works identically in Node and on
// Cloudflare Workers. Pure module: no database or framework imports.

const encoder = new TextEncoder();

interface ParsedSignatureHeader {
  timestamp: string;
  signatures: string[];
}

// Stripe may send several `v1` entries (e.g. during secret rolls); any match
// counts. Returns null on a header that does not carry both `t` and a `v1`.
function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  return timestamp && signatures.length > 0 ? { timestamp, signatures } : null;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// The hex HMAC-SHA256 Stripe puts in `v1`. Exported so tests can sign payloads
// the same way the verifier checks them.
export async function computeStripeSignature(
  rawBody: string,
  timestamp: string,
  secret: string,
): Promise<string> {
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
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  return toHex(new Uint8Array(signature));
}

// Verify a raw webhook body against its `Stripe-Signature` header. Returns the
// parsed (but not schema-validated) event on success, or null on ANY failure:
// missing/malformed header, missing secret, signature mismatch, non-JSON body.
export async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<unknown | null> {
  if (!signatureHeader || !secret) return null;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return null;
  const expected = await computeStripeSignature(rawBody, parsed.timestamp, secret);
  if (!parsed.signatures.some((signature) => timingSafeEqual(signature, expected))) return null;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}
