const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  const values = new Map<string, string[]>();
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) return null;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key || !value) return null;
    values.set(key, [...(values.get(key) ?? []), value]);
  }

  const timestamp = values.get("t")?.[0];
  const signatures = values.get("v1") ?? [];
  return timestamp && signatures.length > 0 ? { timestamp, signatures } : null;
}

async function signatureFor(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  try {
    if (!signatureHeader || !secret) return false;
    const parsed = parseSignatureHeader(signatureHeader);
    if (!parsed) return false;
    const expected = await signatureFor(`${parsed.timestamp}.${rawBody}`, secret);
    return parsed.signatures.some((signature) => timingSafeEqual(expected, signature.toLowerCase()));
  } catch {
    return false;
  }
}
