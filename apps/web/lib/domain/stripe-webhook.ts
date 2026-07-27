// Pure, framework-free Stripe signature verification using Web Crypto.
// Mirrors lib/auth/session.ts to work identically on Node and Cloudflare Workers.

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export interface StripeSignatureHeader {
  timestamp: string;
  signature: string;
}

export function parseStripeSignatureHeader(
  header: string | undefined,
): StripeSignatureHeader | null {
  if (!header) return null;
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=");
    if (key && value) parts[key] = value;
  }
  if (!parts.t || !parts.v1) return null;
  return { timestamp: parts.t, signature: parts.v1 };
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): Promise<boolean> {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const message = `${parsed.timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const computed = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computed, parsed.signature);
}

export function getInvoiceIdFromEvent(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const ev = event as Record<string, unknown>;
  if (!ev.data || typeof ev.data !== "object") return null;
  const data = ev.data as Record<string, unknown>;
  if (!data.object || typeof data.object !== "object") return null;
  const obj = data.object as Record<string, unknown>;
  if (!obj.metadata || typeof obj.metadata !== "object") return null;
  const metadata = obj.metadata as Record<string, unknown>;
  const invoiceId = metadata.invoice_id;
  return typeof invoiceId === "string" ? invoiceId : null;
}
