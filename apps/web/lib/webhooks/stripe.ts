// Stripe webhook signature verification (https://docs.stripe.com/webhooks#verify-events).
// Implemented with Web Crypto (not the `stripe` npm package) so it runs on
// Cloudflare Workers and in hermetic tests with no native module.

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Parses a `Stripe-Signature` header of the form `t=<timestamp>,v1=<signature>`
// (Stripe may include other `v1=`/`v0=` pairs; we only need the first `v1`).
function parseSignatureHeader(header: string): { timestamp: string; signature: string } | null {
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((part) => part.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${parsed.timestamp}.${rawBody}`),
  );
  return timingSafeEqual(toHex(digest), parsed.signature);
}
