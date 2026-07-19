import { createHmac, timingSafeEqual } from "node:crypto";
import { stripeWebhookEventSchema, type StripeWebhookEvent } from "@/lib/validation";

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

export interface ConstructStripeEventOptions {
  tolerance?: number;
  now?: () => number;
}

export function constructStripeEvent(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string | undefined,
  opts?: ConstructStripeEventOptions,
): StripeWebhookEvent {
  if (!signatureHeader) {
    throw new StripeSignatureError("Missing Stripe-Signature header");
  }

  if (!secret) {
    throw new StripeSignatureError("Missing webhook signing secret");
  }

  const tolerance = opts?.tolerance ?? 300; // 5 minutes default
  const now = opts?.now ?? (() => Date.now() / 1000);

  // Parse Stripe-Signature: t=<timestamp>,v1=<signature>,...
  const parts = signatureHeader.split(",");
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (!timestamp) {
    throw new StripeSignatureError("Missing timestamp in Stripe-Signature header");
  }

  if (signatures.length === 0) {
    throw new StripeSignatureError("Missing v1 signature in Stripe-Signature header");
  }

  // Verify timestamp tolerance
  const timestampNum = parseInt(timestamp, 10);
  if (Number.isNaN(timestampNum)) {
    throw new StripeSignatureError("Invalid timestamp in Stripe-Signature header");
  }

  const currentTime = now();
  if (Math.abs(currentTime - timestampNum) > tolerance) {
    throw new StripeSignatureError("Timestamp outside tolerance window");
  }

  // Compute expected signature
  const signedContent = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", secret).update(signedContent).digest("hex");

  // Check against any v1 signatures (timing-safe comparison)
  let isValid = false;
  for (const signature of signatures) {
    try {
      if (timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
        isValid = true;
        break;
      }
    } catch {
      // timingSafeEqual throws if lengths differ, continue to next
    }
  }

  if (!isValid) {
    throw new StripeSignatureError("Invalid signature");
  }

  // Parse and validate the JSON body
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new StripeSignatureError("Invalid JSON in request body");
  }

  return stripeWebhookEventSchema.parse(body);
}
