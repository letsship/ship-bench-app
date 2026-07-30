// Pure Stripe webhook helpers. No framework, database, email, or request
// imports — only Web Crypto (`crypto.subtle`), which is available in both the
// Node 22 test runner and Cloudflare Workers. See the Stripe signature docs:
// the `Stripe-Signature` header is `t=<timestamp>,v1=<hex digest>`, where the
// digest is HMAC-SHA256(`${timestamp}.${rawPayload}`, secret).

const HEADER_RE = /t=(\d+),v1=([0-9a-fA-F]+)/;

function parseSignatureHeader(header: string): { timestamp: string; digest: string } | null {
  const match = HEADER_RE.exec(header);
  if (!match) return null;
  return { timestamp: match[1], digest: match[2].toLowerCase() };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Verify a `Stripe-Signature` header against the raw request payload. Returns
// false for a missing/malformed header, wrong secret, or tampered body.
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;
  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${payload}`);
  return timingSafeEqualHex(expected, parsed.digest);
}

export interface StripeEventLike {
  type?: unknown;
  data?: { object?: { metadata?: { invoice_id?: unknown } } };
}

// Read `event.type` as a string, or null when absent.
export function stripeEventType(event: StripeEventLike): string | null {
  return typeof event.type === "string" ? event.type : null;
}

// Read `event.data.object.metadata.invoice_id` as a string, or null when
// absent. Unknown shapes (missing metadata, non-string value) yield null.
export function stripeInvoiceId(event: StripeEventLike): string | null {
  const id = event.data?.object?.metadata?.invoice_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}
