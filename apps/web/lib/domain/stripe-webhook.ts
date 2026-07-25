// Stripe webhook signature verification using Web Crypto HMAC-SHA256,
// identical to the pattern in lib/auth/session.ts for Workers compatibility.

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  nowMs: number,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",");
  let t: string | null = null;
  let v1: string | null = null;

  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === "t") t = value;
    if (key === "v1") v1 = value;
  }

  if (!t || !v1) return false;

  const timestamp = parseInt(t, 10);
  if (Number.isNaN(timestamp)) return false;

  const ageSeconds = (nowMs - timestamp * 1000) / 1000;
  if (ageSeconds < 0 || ageSeconds > toleranceSeconds) return false;

  const signedContent = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedV1 = bytesToHex(new Uint8Array(signature));

  return timingSafeEqual(v1, expectedV1);
}
