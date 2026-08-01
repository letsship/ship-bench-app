const encoder = new TextEncoder();

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

interface StripeSignature {
  timestamp: string;
  signatures: string[];
}

function parseSignatureHeader(signatureHeader: string | null): StripeSignature {
  if (!signatureHeader) throw new StripeSignatureError("Missing Stripe signature");

  const values = signatureHeader.split(",").reduce<Record<string, string[]>>((parsed, part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return parsed;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!value) return parsed;
    return { ...parsed, [key]: [...(parsed[key] ?? []), value] };
  }, {});

  const timestamp = values.t?.[0];
  const signatures = values.v1 ?? [];
  if (!timestamp || signatures.length === 0) {
    throw new StripeSignatureError("Malformed Stripe signature");
  }
  return { timestamp, signatures };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<void> {
  if (!secret) throw new StripeSignatureError("Missing Stripe webhook secret");
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  const expected = await sign(`${timestamp}.${rawBody}`, secret);
  if (!signatures.some((signature) => timingSafeEqual(signature, expected))) {
    throw new StripeSignatureError("Invalid Stripe signature");
  }
}

export async function constructStripeEvent(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<unknown> {
  await verifyStripeSignature(rawBody, signatureHeader, secret);
  return JSON.parse(rawBody) as unknown;
}
