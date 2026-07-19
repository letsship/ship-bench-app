// Stripe webhook signature verification using Web Crypto (Workers-compatible).
// No 'stripe' npm dep — keeps the Cloudflare Workers bundle clean.

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      metadata?: Record<string, string>;
    };
  };
}

const textEncoder = new TextEncoder();

// Parse the Stripe-Signature header into its t (timestamp) and v1 (hash) parts.
function parseSignatureHeader(header: string): { t: string; v1: string } | null {
  const parts = header.split(",");
  let t = "";
  let v1 = "";

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") t = value;
    if (key === "v1") v1 = value;
  }

  return t && v1 ? { t, v1 } : null;
}

// Constant-time string comparison to prevent timing attacks.
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Verify a Stripe webhook signature using HMAC-SHA256 and Web Crypto.
// payload: raw request body (must be the exact bytes received, not parsed JSON)
// signatureHeader: value of the Stripe-Signature header
// secret: STRIPE_WEBHOOK_SECRET
// Returns true if the signature is valid, false on any invalid/missing input.
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  if (!payload || !signatureHeader || !secret) {
    return false;
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return false;
  }

  try {
    // Create the HMAC key from the secret (strip the "whsec_" prefix if present,
    // and treat the remainder as the signing secret bytes, not a base64 string).
    const secretBytes = textEncoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Sign the message: t.payload
    const message = `${parsed.t}.${payload}`;
    const messageBytes = textEncoder.encode(message);
    const signatureBytes = await crypto.subtle.sign("HMAC", key, messageBytes);

    // Convert signature to hex string for comparison.
    const computedV1 = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time compare against the provided v1.
    return constantTimeCompare(computedV1, parsed.v1);
  } catch {
    return false;
  }
}
