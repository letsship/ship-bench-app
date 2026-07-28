// Pure, framework-free Stripe signature verification using Web Crypto
// (crypto.subtle — Cloudflare Workers compatible). Stripe sends a
// Stripe-Signature header in the form "t=timestamp,v1=signature[,v1=…]";
// we recompute HMAC-SHA256("${t}.${rawBody}", secret) and compare.

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time comparison to prevent timing attacks on the HMAC digest.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate the longer one to avoid leaking length difference.
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    let diff = longer.length - shorter.length;
    for (let i = 0; i < shorter.length; i++) {
      diff |= longer[i].charCodeAt(0) ^ shorter[i].charCodeAt(0);
    }
    return diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface VerifyOptions {
  /** Tolerance in seconds for the timestamp (default 300 = 5 min). */
  toleranceSeconds?: number;
  /** Inject a fixed "now" in seconds (for hermetic tests). */
  nowSeconds?: number;
}

/**
 * Verify a Stripe webhook signature.
 *
 * @param rawBody - The raw request body as a UTF-8 string.
 * @param signatureHeader - The value of the `Stripe-Signature` header.
 * @param secret - The webhook signing secret (starts with `whsec_`).
 * @param opts - Optional tolerance and injectable clock.
 * @returns `true` iff the header is present, well-formed, and contains a
 *          valid signature for `rawBody` under `secret`.
 */
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  opts?: VerifyOptions,
): Promise<boolean> {
  if (!rawBody || !signatureHeader || !secret) return false;

  // Parse the header: "t=1734567890,v1=a1b2c3d4,v1=e5f6g7h8"
  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) return false;

  // Check timestamp tolerance
  const tolerance = opts?.toleranceSeconds ?? 300;
  const now = opts?.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > tolerance) return false;

  // Build the signed payload: "timestamp.rawBody"
  const signedPayload = `${timestamp}.${rawBody}`;

  // Compute HMAC-SHA256 using Web Crypto
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hmac = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = hex(hmac);

  // Compare against every v1 value — accept if any matches.
  return signatures.some((sig) => timingSafeEqual(expected, sig));
}