// Pure, framework-free Stripe webhook helpers. Signature verification follows
// Stripe's scheme (https://docs.stripe.com/webhooks#verify-events): the
// `Stripe-Signature` header is `t=<unix-seconds>,v1=<hex-hmac>`, and the HMAC
// is computed over `${t}.${rawBody}` with SHA-256. Uses Web Crypto so it runs
// identically in Node and on Cloudflare Workers (no native module, no network).

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      metadata?: { invoice_id?: string };
    };
  };
}

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

interface ParsedSignature {
  timestamp: string;
  v1: string;
}

function parseSignatureHeader(header: string): ParsedSignature | null {
  const parts = header.split(",").map((part) => part.trim());
  let timestamp: string | null = null;
  let v1: string | null = null;
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=");
    if (key === "t") timestamp = value;
    else if (key === "v1") v1 = value;
  }
  if (!timestamp || !v1) return null;
  return { timestamp, v1 };
}

export interface VerifySignatureOptions {
  // Reject events whose `t=` timestamp is older than this many milliseconds.
  // Defaults to 5 minutes, matching Stripe's recommendation. Set to 0 to skip.
  toleranceMs?: number;
  // Injectable clock for testing the tolerance check.
  nowMs?: number;
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  opts: VerifySignatureOptions = {},
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const expected = await hmacHex(secret, `${parsed.timestamp}.${rawBody}`);
  if (!timingSafeEqual(expected, parsed.v1)) return false;

  const toleranceMs = opts.toleranceMs ?? 5 * 60_000;
  if (toleranceMs > 0) {
    const nowMs = opts.nowMs ?? Date.now();
    const eventMs = Number(parsed.timestamp) * 1000;
    if (!Number.isFinite(eventMs)) return false;
    if (Math.abs(nowMs - eventMs) > toleranceMs) return false;
  }
  return true;
}

export function invoiceIdFromEvent(event: StripeEvent): string | null {
  const invoiceId = event.data?.object?.metadata?.invoice_id;
  return typeof invoiceId === "string" && invoiceId.length > 0 ? invoiceId : null;
}

// Build a Stripe-shaped `Stripe-Signature` header for a payload. Used by tests
// (and any local dev harness) so fixtures are signed with the same Web Crypto
// HMAC as the verifier — no real Stripe SDK required.
export async function signStripePayload(
  rawBody: string,
  secret: string,
  timestampSeconds: number,
): Promise<string> {
  const v1 = await hmacHex(secret, `${timestampSeconds}.${rawBody}`);
  return `t=${timestampSeconds},v1=${v1}`;
}
