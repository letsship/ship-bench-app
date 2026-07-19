// Stripe webhook signature verification using Web Crypto (matches crypto.subtle HMAC
// pattern in lib/auth/session.ts). Parses Stripe-Signature header and verifies request
// authenticity. Pure domain logic, no framework or DB dependencies.

const encoder = new TextEncoder();

interface ParsedHeader {
  t: string;
  v1: string[];
}

export function parseStripeSignatureHeader(header: string): ParsedHeader | null {
  const parts = header.split(",");
  let t: string | null = null;
  const v1: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || !value) return null;
    if (key === "t") t = value;
    else if (key === "v1") v1.push(value);
  }

  return t && v1.length > 0 ? { t, v1 } : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parsed = parseStripeSignatureHeader(header);
  if (!parsed) return false;

  const signedContent = `${parsed.t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return parsed.v1.some((sig) => timingSafeEqual(sig, computed));
}

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      metadata?: {
        invoice_id?: string;
      };
    };
  };
}

export function parseStripeEvent(body: unknown): StripeEvent | null {
  const event = body as StripeEvent;
  return typeof event?.id === "string" && typeof event?.type === "string" && event?.data?.object
    ? event
    : null;
}

export function invoiceIdFromEvent(event: StripeEvent): string | undefined {
  return event.data.object.metadata?.invoice_id;
}
