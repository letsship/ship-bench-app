import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-webhook";

const SECRET = "whsec_test_secret";

async function sign(secret: string, timestamp: number, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function header(timestamp: number, signature: string): string {
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyStripeSignature", () => {
  it("verifies a validly signed payload", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const timestamp = Math.floor(now.getTime() / 1000);
    const payload = JSON.stringify({ id: "evt_1" });
    const signature = await sign(SECRET, timestamp, payload);

    expect(await verifyStripeSignature(payload, header(timestamp, signature), SECRET, now)).toBe(
      true,
    );
  });

  it("rejects a tampered payload", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const timestamp = Math.floor(now.getTime() / 1000);
    const payload = JSON.stringify({ id: "evt_1" });
    const signature = await sign(SECRET, timestamp, payload);
    const tampered = JSON.stringify({ id: "evt_2" });

    expect(await verifyStripeSignature(tampered, header(timestamp, signature), SECRET, now)).toBe(
      false,
    );
  });

  it("rejects the wrong secret", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const timestamp = Math.floor(now.getTime() / 1000);
    const payload = JSON.stringify({ id: "evt_1" });
    const signature = await sign("whsec_other_secret", timestamp, payload);

    expect(await verifyStripeSignature(payload, header(timestamp, signature), SECRET, now)).toBe(
      false,
    );
  });

  it("rejects a missing signature header", async () => {
    expect(await verifyStripeSignature("{}", null, SECRET)).toBe(false);
  });

  it("rejects a malformed signature header", async () => {
    expect(await verifyStripeSignature("{}", "not-a-valid-header", SECRET)).toBe(false);
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const staleTimestamp = Math.floor(now.getTime() / 1000) - 10 * 60;
    const payload = JSON.stringify({ id: "evt_1" });
    const signature = await sign(SECRET, staleTimestamp, payload);

    expect(
      await verifyStripeSignature(payload, header(staleTimestamp, signature), SECRET, now),
    ).toBe(false);
  });
});
