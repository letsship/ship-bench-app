// Stripe webhook signature verification using WebCrypto HMAC-SHA256.
// Implements https://docs.stripe.com/webhooks#verify-events

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret) return false;

  // Parse the header: "t=<timestamp>,v1=<signature>[,v1=<signature>...]"
  const parts = signatureHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.t = value;
      if (key === "v1") acc.v1.push(value);
      return acc;
    },
    { t: "", v1: [] as string[] },
  );

  if (!parts.t || parts.v1.length === 0) return false;

  const encoder = new TextEncoder();
  const signedContent = `${parts.t}.${rawBody}`;

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

  // Check against any v1 signature in the header (constant-time compare).
  return parts.v1.some((headerSig) => timingSafeEqual(computed, headerSig));
}
