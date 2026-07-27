// Stripe webhook primitives: signature verification and event parsing. No
// framework, database, or request concerns — see docs/vendor or
// https://docs.stripe.com/webhooks#verify-events for the signing scheme this
// mirrors, so hermetic tests can sign payloads with the same secret.

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

interface ParsedSignatureHeader {
  timestamp: string;
  signatures: string[];
}

// The Stripe-Signature header looks like `t=1614556800,v1=abc...,v1=def...`.
// Multiple v1 entries appear during secret rotation; any match is accepted.
function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return parsed.signatures.some((signature) => {
    if (!/^[0-9a-f]+$/i.test(signature)) return false;
    const signatureBuffer = Buffer.from(signature, "hex");
    if (signatureBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, signatureBuffer);
  });
}

export const stripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    object: z
      .object({
        metadata: z.record(z.string(), z.string()).optional(),
      })
      .passthrough(),
  }),
});

export interface StripeEvent {
  id: string;
  type: string;
  invoiceId: string | null;
}

export function parseStripeEvent(rawBody: string): StripeEvent {
  const json: unknown = JSON.parse(rawBody);
  const parsed = stripeEventSchema.parse(json);
  return {
    id: parsed.id,
    type: parsed.type,
    invoiceId: parsed.data.object.metadata?.invoice_id ?? null,
  };
}
