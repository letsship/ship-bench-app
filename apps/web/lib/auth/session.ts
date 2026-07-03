import { cookies } from "next/headers";
import { HttpError } from "@/lib/http";
import { SESSION_COOKIE } from "./cookie";

// Dev magic-link stub. There is no real identity provider: "signing in" just
// mints an HMAC-signed cookie naming the operator's email. The signing uses Web
// Crypto so it works identically in Node and on Cloudflare Workers. This is a
// fixture app — do not model production auth on it.

export { SESSION_COOKIE };
const encoder = new TextEncoder();

interface SessionPayload {
  email: string;
  issuedAt: number;
}

export interface Session {
  email: string;
}

function sessionSecret(): string {
  return process.env.STUDIOBOOK_SESSION_SECRET ?? "studiobook-dev-session-secret";
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return base64url(new Uint8Array(signature));
}

export async function createSessionToken(email: string): Promise<string> {
  const payload: SessionPayload = { email, issuedAt: Date.now() };
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body)}`;
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (!timingSafeEqual(signature, await sign(body))) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as SessionPayload;
    return typeof payload.email === "string" ? { email: payload.email } : null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "unauthorized", "Sign in required");
  return session;
}

export async function startSession(email: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(email), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
