// Stripe webhook signature verification, reimplemented over Web Crypto
// (`crypto.subtle`) instead of the `stripe` npm package so the route stays
// Cloudflare Workers-compatible and hermetic tests need no network access.
// Scheme: https://docs.stripe.com/webhooks#verify-events — the
// `Stripe-Signature` header carries a timestamp and one or more HMAC-SHA256
// signatures of `${timestamp}.${rawBody}` keyed by the webhook signing secret.

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  const parts = header.split(",").map((part) => part.trim());
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t" && value) timestamp = value;
    else if (key === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
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

export interface VerifyStripeSignatureOptions {
  toleranceSeconds?: number;
}

// Verifies a raw request body against the Stripe-Signature header. Returns
// true only when the header parses, at least one v1 signature matches the
// recomputed HMAC, and the timestamp is within tolerance of `now`.
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  now: Date = new Date(),
  options: VerifyStripeSignatureOptions = {},
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const timestampSeconds = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const ageSeconds = Math.abs(now.getTime() / 1000 - timestampSeconds);
  if (ageSeconds > tolerance) return false;

  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${rawBody}`);
  return parsed.signatures.some((signature) => timingSafeEqual(signature, expected));
}
