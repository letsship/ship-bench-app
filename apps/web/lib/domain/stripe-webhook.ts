import { HttpError } from "@/lib/http";

const encoder = new TextEncoder();

export interface StripeEventData {
  object: {
    metadata?: Record<string, string>;
    [key: string]: unknown;
  };
}

export interface StripeEvent {
  id: string;
  type: string;
  data: StripeEventData;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<StripeEvent> {
  if (!signatureHeader) {
    throw new HttpError(400, "bad_request", "Missing Stripe-Signature header");
  }

  const pairs = signatureHeader.split(",").reduce(
    (acc, pair) => {
      const [key, value] = pair.trim().split("=");
      if (key && value) acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  const t = pairs.t;
  const v1 = pairs.v1;

  if (!t || !v1) {
    throw new HttpError(400, "bad_request", "Malformed Stripe-Signature header");
  }

  const signedContent = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const computedSignature = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (!timingSafeEqual(computedSignature, v1)) {
    throw new HttpError(400, "bad_request", "Invalid Stripe signature");
  }

  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    throw new HttpError(400, "bad_request", "Invalid JSON in webhook body");
  }
}
