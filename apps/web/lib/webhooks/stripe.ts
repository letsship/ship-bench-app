import { createHmac, timingSafeEqual } from "node:crypto";
import {
  stripeWebhookEventSchema,
  type StripeWebhookEvent,
} from "@/lib/validation";

export type StripeEvent = StripeWebhookEvent;

export class InvalidStripeWebhookError extends Error {
  constructor(message = "Invalid Stripe webhook") {
    super(message);
    this.name = "InvalidStripeWebhookError";
  }
}

function parseSignatureHeader(header: string | null): { timestamp: string; signatures: string[] } {
  if (!header) throw new InvalidStripeWebhookError();

  const entries = header.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = entries.find(([key]) => key === "t")?.[1];
  const signatures = entries.flatMap(([key, value]) =>
    key === "v1" && value && /^[0-9a-f]{64}$/i.test(value) ? [value] : [],
  );

  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) {
    throw new InvalidStripeWebhookError();
  }
  return { timestamp, signatures };
}

function signatureMatches(expected: Buffer, signature: string): boolean {
  const candidate = Buffer.from(signature, "hex");
  return candidate.length === expected.length && timingSafeEqual(expected, candidate);
}

export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  signingSecret: string | undefined,
): StripeEvent {
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (!signingSecret) throw new InvalidStripeWebhookError();

  const expected = createHmac("sha256", signingSecret).update(`${timestamp}.${rawBody}`).digest();
  if (!signatures.some((signature) => signatureMatches(expected, signature))) {
    throw new InvalidStripeWebhookError();
  }

  try {
    return stripeWebhookEventSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    if (error instanceof SyntaxError) throw new InvalidStripeWebhookError("Invalid Stripe payload");
    throw error;
  }
}
