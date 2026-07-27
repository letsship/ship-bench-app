// Stripe webhook signature verification and event selectors — pure, with no
// framework, database, or request imports. Signatures are checked exactly as
// https://docs.stripe.com/webhooks#verify-events describes: HMAC-SHA256 over
// `${timestamp}.${payload}` compared against a `v1` entry of the
// `Stripe-Signature` header. Web Crypto is used (never node:crypto) so the same
// code runs on Cloudflare Workers and under Vitest.

export interface StripeSignatureHeader {
  timestamp: string;
  signatures: string[];
}

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: { metadata?: { invoice_id?: string } } };
}

export const INVOICE_PAID_EVENT = "invoice.paid";

const encoder = new TextEncoder();

const headerPairs = (header: string): [string, string][] =>
  header.split(",").flatMap((part) => {
    const [key, ...rest] = part.trim().split("=");
    return rest.length > 0 ? [[key, rest.join("=")] as [string, string]] : [];
  });

// `t=1699999999,v1=<hex>[,v1=<hex>]` → its parts. Null when the header is
// missing or does not carry both a timestamp and at least one v1 signature.
export function parseStripeSignatureHeader(
  header: string | null | undefined,
): StripeSignatureHeader | null {
  if (!header) return null;
  const pairs = headerPairs(header);
  const timestamp = pairs.find(([key]) => key === "t")?.[1];
  const signatures = pairs.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

// The hex v1 signature for a payload. Exported so tests can sign a body with
// the same code path the verifier uses.
export async function computeStripeSignature(input: {
  payload: string;
  timestamp: string;
  secret: string;
}): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${input.timestamp}.${input.payload}`)),
  );
}

// Compare without leaking where two equal-length strings first differ.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// False for a missing/malformed header, an empty secret, or any payload the
// secret does not sign — the route turns that into a 400 and changes nothing.
export async function verifyStripeSignature(input: {
  payload: string;
  header: string | null | undefined;
  secret: string | undefined;
}): Promise<boolean> {
  if (!input.secret) return false;
  const parsed = parseStripeSignatureHeader(input.header);
  if (!parsed) return false;
  const expected = await computeStripeSignature({
    payload: input.payload,
    timestamp: parsed.timestamp,
    secret: input.secret,
  });
  return parsed.signatures.some((signature) => timingSafeEqual(signature, expected));
}

export function isInvoicePaidEvent(event: { type: string }): boolean {
  return event.type === INVOICE_PAID_EVENT;
}

// Stripe carries our invoice id in the object's metadata; absent for events we
// do not own, which the service acknowledges without changing anything.
export function extractInvoiceId(event: StripeEventLike): string | null {
  return event.data.object.metadata?.invoice_id ?? null;
}
