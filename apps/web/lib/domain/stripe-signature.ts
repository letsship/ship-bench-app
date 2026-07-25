// Stripe webhook signature verification using Web Crypto API (Workers-compatible).
// Stripe signs each webhook with: t=<timestamp>,v1=<hmac-sha256(t.payload, secret)>

const encoder = new TextEncoder();

function base16(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export interface VerifyStripeSignatureOptions {
  payload: string; // raw body string
  header: string; // Stripe-Signature header value
  secret: string; // webhook signing secret
  toleranceSeconds?: number; // default 300
  nowSeconds?: number; // default Date.now() / 1000
}

export async function verifyStripeSignature({
  payload,
  header,
  secret,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
}: VerifyStripeSignatureOptions): Promise<boolean> {
  // Parse header: t=<timestamp>,v1=<signature>[,v0=<old_signature>]
  const parts = header.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.trim().split("=");
      if (key === "t") acc.timestamp = parseInt(value, 10);
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: 0, signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  // Enforce timestamp tolerance
  const age = nowSeconds - parts.timestamp;
  if (age < 0 || age > toleranceSeconds) return false;

  // Recompute the expected signature: HMAC-SHA256("t.payload", secret)
  const signedContent = `${parts.timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedSignature = base16(new Uint8Array(signature));

  // Check if any of the provided signatures match (timing-safe compare)
  return parts.signatures.some((sig) => timingSafeEqual(sig, expectedSignature));
}

export interface SignStripePayloadOptions {
  payload: string; // raw body string
  secret: string; // webhook signing secret
  timestampSeconds?: number; // default Date.now() / 1000
}

export async function signStripePayload({
  payload,
  secret,
  timestampSeconds = Math.floor(Date.now() / 1000),
}: SignStripePayloadOptions): Promise<string> {
  // Build the same signed content Stripe would
  const signedContent = `${timestampSeconds}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const hexSignature = base16(new Uint8Array(signature));
  return `t=${timestampSeconds},v1=${hexSignature}`;
}
