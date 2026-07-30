import { z } from "zod";

// Stripe webhook signature verification, kept pure (no db, request, or env
// imports) so it is unit-testable in isolation. Stripe signs every delivery with
// an HMAC-SHA256 over the signed payload `<timestamp>.<rawBody>` and sends it as
// `Stripe-Signature: t=<timestamp>,v1=<hex>` (several v1 entries appear while a
// secret is being rotated). We recompute the HMAC with Web Crypto — available on
// Cloudflare Workers, so no `stripe` npm dependency — and compare in constant
// time. The signing secret is used verbatim, including its `whsec_` prefix,
// exactly as Stripe's own verifier does.
// Docs: https://docs.stripe.com/webhooks#verify-events

// Only the fields the app consumes. Unknown keys are ignored by Zod, and every
// nested level is optional because non-invoice events carry a different shape.
export const stripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z
    .object({
      object: z
        .object({
          metadata: z.object({ invoice_id: z.string().min(1).optional() }).nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

export type StripeEvent = z.infer<typeof stripeEventSchema>;

// The Studiobook invoice a Stripe event refers to, if it names one.
export function invoiceIdFromEvent(event: StripeEvent): string | null {
  return event.data?.object?.metadata?.invoice_id ?? null;
}

interface SignatureHeader {
  timestamp: string;
  signatures: readonly string[];
}

// `t=1614556800,v1=abc…,v1=def…` → timestamp + every v1 candidate.
export function parseStripeSignatureHeader(header: string): SignatureHeader | null {
  const pairs = header.split(",").map((part) => part.trim().split("="));
  const timestamp = pairs.find(([key]) => key === "t")?.[1];
  const signatures = pairs.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!timestamp || signatures.length === 0 || signatures.some((value) => value === "")) {
    return null;
  }
  return { timestamp, signatures };
}

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export async function signStripePayload(
  secret: string,
  timestamp: string,
  payload: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`)));
}

// Length-independent comparison that does not short-circuit on the first
// differing character, so a mismatch leaks no timing information.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface VerifyStripeWebhookInput {
  payload: string;
  header: string | null;
  secret: string;
}

// Verify a raw request body against its Stripe-Signature header, returning the
// parsed event on success and null for anything that is not provably from
// Stripe (absent/malformed header, wrong secret, tampered body, non-event JSON).
export async function verifyStripeWebhook({
  payload,
  header,
  secret,
}: VerifyStripeWebhookInput): Promise<StripeEvent | null> {
  if (!header || !secret) return null;
  const parsed = parseStripeSignatureHeader(header);
  if (!parsed) return null;

  const expected = await signStripePayload(secret, parsed.timestamp, payload);
  if (!parsed.signatures.some((candidate) => timingSafeEqual(candidate, expected))) return null;

  return parseStripeEvent(payload);
}

// Parse an already-verified body into the event shape the services consume.
export function parseStripeEvent(payload: string): StripeEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch (error) {
    console.error("Stripe webhook body is not valid JSON", error);
    return null;
  }
  const event = stripeEventSchema.safeParse(json);
  if (!event.success) {
    console.error("Stripe webhook body is not a Stripe event", event.error.flatten());
    return null;
  }
  return event.data;
}
