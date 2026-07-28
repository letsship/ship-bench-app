import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe webhook signature verification, implemented directly (no Stripe SDK)
// per https://docs.stripe.com/webhooks#verify-events. The Stripe-Signature
// header looks like "t=1492774577,v1=<hex>,v1=<hex>,v0=<hex>"; the signed
// payload is `${t}.${rawBody}` under HMAC-SHA256 with the endpoint secret.
// Pure and framework-free: the caller injects nowMs so tests are deterministic.

const DEFAULT_TOLERANCE_SECONDS = 300;

export interface VerifySignatureInput {
  payload: string;
  header: string | null;
  secret: string;
  nowMs: number;
  toleranceSeconds?: number;
}

const sign = (secret: string, timestamp: number, payload: string): string =>
  createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");

const parseHeader = (header: string): { timestamp: number; signatures: string[] } | null => {
  const parts = header.split(",").map((part) => part.split("=", 2) as [string, string]);
  const timestampPart = parts.find(([key]) => key === "t");
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestampPart || signatures.length === 0) return null;
  const timestamp = Number(timestampPart[1]);
  if (!Number.isFinite(timestamp)) return null;
  return { timestamp, signatures };
};

const matchesAnySignature = (expected: string, signatures: string[]): boolean => {
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8");
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
};

export function verifyStripeSignature(input: VerifySignatureInput): boolean {
  if (!input.header) return false;
  const parsed = parseHeader(input.header);
  if (!parsed) return false;
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(input.nowMs / 1000 - parsed.timestamp) > tolerance) return false;
  const expected = sign(input.secret, parsed.timestamp, input.payload);
  return matchesAnySignature(expected, parsed.signatures);
}

// Test-only helper for building a valid Stripe-Signature header.
export function signStripePayload(secret: string, payload: string, timestampSeconds: number): string {
  return `t=${timestampSeconds},v1=${sign(secret, timestampSeconds, payload)}`;
}

// Safely pull the invoice id a payment event points at, if it carries one.
export function extractInvoiceId(event: {
  data?: { object?: { metadata?: { invoice_id?: unknown } } };
}): string | null {
  const invoiceId = event.data?.object?.metadata?.invoice_id;
  return typeof invoiceId === "string" && invoiceId.length > 0 ? invoiceId : null;
}
