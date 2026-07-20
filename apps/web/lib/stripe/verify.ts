// Stripe signature verification using Web Crypto HMAC-SHA256. Verifies that a
// request came from Stripe by checking the Stripe-Signature header against our
// webhook signing secret. The timestamp tolerance prevents replay attacks.

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyStripeSignature(opts: {
  payload: string;
  header: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowMs?: number;
}): Promise<boolean> {
  const { payload, header, secret, toleranceSeconds = 300, nowMs = Date.now() } = opts;

  if (!header || !secret) return false;

  // Parse the header: "t=timestamp,v1=signature1,v1=signature2,..."
  const headerParts = header.split(",");
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of headerParts) {
    const [key, value] = part.trim().split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) return false;

  // Enforce timestamp tolerance
  const timestampMs = parseInt(timestamp, 10) * 1000;
  if (Number.isNaN(timestampMs) || Math.abs(nowMs - timestampMs) > toleranceSeconds * 1000) {
    return false;
  }

  // Recompute HMAC over "{timestamp}.{payload}"
  const message = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const computedSignature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const computedHex = Array.from(new Uint8Array(computedSignature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Check if any of the provided signatures match
  return signatures.some((sig) => timingSafeEqual(sig, computedHex));
}

export async function constructStripeEvent(
  payload: string,
  header: string | null,
  secret: string,
): Promise<unknown> {
  const isValid = await verifyStripeSignature({ payload, header, secret });
  if (!isValid) {
    return null;
  }
  return JSON.parse(payload);
}
