import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-webhooks";

const SECRET = "whsec_test_secret";

async function signHeader(
  payload: string,
  secret: string,
  timestamp = "1700000000",
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

describe("verifyStripeSignature", () => {
  it("accepts a validly signed payload", async () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const header = await signHeader(payload, SECRET);
    expect(await verifyStripeSignature(payload, header, SECRET)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const header = await signHeader(payload, SECRET);
    expect(await verifyStripeSignature(JSON.stringify({ id: "evt_2" }), header, SECRET)).toBe(
      false,
    );
  });

  it("rejects a missing header", async () => {
    const payload = JSON.stringify({ id: "evt_1" });
    expect(await verifyStripeSignature(payload, null, SECRET)).toBe(false);
  });

  it("rejects a malformed header", async () => {
    const payload = JSON.stringify({ id: "evt_1" });
    expect(await verifyStripeSignature(payload, "not-a-valid-header", SECRET)).toBe(false);
    expect(await verifyStripeSignature(payload, "t=1700000000", SECRET)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const header = await signHeader(payload, "whsec_wrong_secret");
    expect(await verifyStripeSignature(payload, header, SECRET)).toBe(false);
  });
});
