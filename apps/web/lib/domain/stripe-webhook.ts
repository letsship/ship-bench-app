import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe webhook signature verification (docs.stripe.com/webhooks#verify-events).
// The Stripe-Signature header carries a `t=` unix timestamp and one or more
// `v1=` hex HMAC-SHA256 signatures over `${t}.${rawBody}`, signed with the
// endpoint's webhook signing secret. Node `crypto` is a pure builtin, so this
// stays framework/DB/request-free like every other lib/domain module.

const DEFAULT_TOLERANCE_SECONDS = 300;

export interface ParsedSignatureHeader {
  timestampSeconds: number;
  signatures: string[];
}

// Parse "t=...,v1=...,v1=..." into its parts; null when either piece is absent.
export function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  let timestampSeconds: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      timestampSeconds = parsed;
    } else if (key === "v1" && value.length > 0) {
      signatures.push(value);
    }
  }
  if (timestampSeconds === null || signatures.length === 0) return null;
  return { timestampSeconds, signatures };
}

function signatureMatches(expected: Buffer, candidateHex: string): boolean {
  const candidate = Buffer.from(candidateHex, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// True only when the header carries a fresh, correctly-computed signature.
// Never throws: any null/malformed/mismatched input is simply false.
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  opts: { toleranceSeconds?: number; nowMs?: number } = {},
): boolean {
  if (!header || !secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  // Reject stale timestamps so a captured header cannot be replayed forever.
  const toleranceSeconds = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowMs = opts.nowMs ?? Date.now();
  if (toleranceSeconds > 0) {
    const ageMs = Math.abs(nowMs - parsed.timestampSeconds * 1000);
    if (ageMs > toleranceSeconds * 1000) return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestampSeconds}.${payload}`, "utf8")
    .digest();
  return parsed.signatures.some((signature) => signatureMatches(expected, signature));
}
