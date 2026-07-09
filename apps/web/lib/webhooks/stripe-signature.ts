// Verifies Stripe's webhook signature by hand with Web Crypto, rather than the
// `stripe` SDK — this app deploys to Cloudflare Workers via OpenNext, and the
// codebase already hand-rolls HMAC in lib/auth/session.ts for the same
// edge-runtime-compatibility reason. See https://docs.stripe.com/webhooks#verify-events.

const encoder = new TextEncoder();

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const pair of header.split(",")) {
    const [key, value] = pair.split("=", 2);
    if (key === "t") timestamp = value;
    else if (key === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
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
  return toHex(signature);
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;
  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${rawBody}`);
  return parsed.signatures.some((signature) => timingSafeEqual(signature, expected));
}
