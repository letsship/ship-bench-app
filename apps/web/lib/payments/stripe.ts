// Stripe webhook signature verification (docs.stripe.com/webhooks#verify-events).
// Hand-rolled with Web Crypto (no `stripe` npm dependency) so it works
// identically on Cloudflare Workers, matching the HMAC pattern already used for
// the session cookie in `lib/auth/session.ts`.

const encoder = new TextEncoder();
const TOLERANCE_SECONDS = 5 * 60;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
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
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Verifies a raw request body against Stripe's `Stripe-Signature` header:
// `t=<unix seconds>,v1=<hex hmac>`. Rejects a missing/malformed header, a
// signature computed with a different secret or payload, and a timestamp
// outside a 5 minute tolerance (replay protection).
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  now: number,
): Promise<boolean> {
  if (!header) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const timestampSeconds = Number.parseInt(parsed.timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(now / 1000 - timestampSeconds) > TOLERANCE_SECONDS) return false;

  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${payload}`);
  return parsed.signatures.some((signature) => timingSafeEqual(signature, expected));
}
