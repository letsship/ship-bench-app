// Stripe webhook signature verification (https://docs.stripe.com/webhooks#verify-events).
// Pure and framework-free: no request/db/env imports. Uses Web Crypto so it
// runs identically on Node and Cloudflare Workers, matching the HMAC approach
// already used for session cookies (see `lib/auth/session.ts`).

const encoder = new TextEncoder();

export interface StripeSignatureHeader {
  timestamp: number;
  v1: string[];
}

// Parses a `t=1614556800,v1=abc,v1=def` header into a timestamp and the set of
// v1 signatures (Stripe sends more than one during secret rotation). Returns
// null for a missing, empty, or malformed header (no timestamp or no v1s).
export function parseSignatureHeader(
  header: string | null | undefined,
): StripeSignatureHeader | null {
  if (!header) return null;
  let timestamp: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t" && value) timestamp = Number(value);
    else if (key === "v1" && value) v1.push(value);
  }
  if (timestamp === null || Number.isNaN(timestamp) || v1.length === 0) return null;
  return { timestamp, v1 };
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

async function sign(secret: string, signedPayload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  return toHex(new Uint8Array(signature));
}

export interface VerifyStripeSignatureOptions {
  // Injected clock + tolerance for deterministic tests. Tolerance is skipped
  // (no timestamp check) unless both are provided.
  now?: Date;
  toleranceSeconds?: number;
}

// Verifies a raw request body against Stripe's `Stripe-Signature` header:
// recomputes HMAC-SHA256(secret, `${t}.${payload}`) and constant-time-compares
// it against every v1 value in the header.
export async function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  opts: VerifyStripeSignatureOptions = {},
): Promise<boolean> {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  if (opts.now && opts.toleranceSeconds !== undefined) {
    const ageSeconds = Math.abs(opts.now.getTime() / 1000 - parsed.timestamp);
    if (ageSeconds > opts.toleranceSeconds) return false;
  }

  const expected = await sign(secret, `${parsed.timestamp}.${payload}`);
  return parsed.v1.some((candidate) => timingSafeEqual(candidate, expected));
}
