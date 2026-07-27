// Stripe webhook signature verification using Web Crypto HMAC-SHA256.
// Stripe signs "{t}.{rawBody}" with the endpoint's signing secret and sends
// "Stripe-Signature: t=<ts>,v1=<hex>". This module verifies that signature
// and parses the resulting event without framework, db, or request imports.

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      metadata?: Record<string, string>;
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

export async function verifyStripeSignature(
  payload: string,
  header: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!header || !secret) return false;

  const parts = header.split(",");
  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signature = value;
  }

  if (!timestamp || !signature) return false;

  const signedContent = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const computedSignature = bytesToHex(new Uint8Array(digest));

  return timingSafeEqual(signature, computedSignature);
}

export function parseStripeEvent(raw: string): StripeEvent {
  return JSON.parse(raw) as StripeEvent;
}
