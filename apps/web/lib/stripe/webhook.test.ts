import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/http";
import { verifyAndParseStripeEvent } from "./webhook";

const SECRET = "whsec_test_secret";
const encoder = new TextEncoder();

async function sign(secret: string, timestamp: string, payload: string): Promise<string> {
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
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function samplePayload(): string {
  return JSON.stringify({
    id: "evt_123",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: "inv_1" } } },
  });
}

describe("verifyAndParseStripeEvent", () => {
  it("verifies a correctly-signed payload and returns the parsed event", async () => {
    const payload = samplePayload();
    const timestamp = "1700000000";
    const signature = await sign(SECRET, timestamp, payload);
    const header = `t=${timestamp},v1=${signature}`;

    const event = await verifyAndParseStripeEvent(payload, header, SECRET);
    expect(event.id).toBe("evt_123");
    expect(event.type).toBe("invoice.paid");
    expect(event.data.object.metadata?.invoice_id).toBe("inv_1");
  });

  it("rejects a tampered payload", async () => {
    const payload = samplePayload();
    const timestamp = "1700000000";
    const signature = await sign(SECRET, timestamp, payload);
    const header = `t=${timestamp},v1=${signature}`;
    const tamperedPayload = samplePayload().replace("inv_1", "inv_2");

    await expect(verifyAndParseStripeEvent(tamperedPayload, header, SECRET)).rejects.toThrow(
      HttpError,
    );
  });

  it("rejects a signature made with a different secret", async () => {
    const payload = samplePayload();
    const timestamp = "1700000000";
    const signature = await sign("whsec_other_secret", timestamp, payload);
    const header = `t=${timestamp},v1=${signature}`;

    await expect(verifyAndParseStripeEvent(payload, header, SECRET)).rejects.toThrow(HttpError);
  });

  it("rejects a missing Stripe-Signature header", async () => {
    await expect(verifyAndParseStripeEvent(samplePayload(), null, SECRET)).rejects.toThrow(
      HttpError,
    );
  });

  it("rejects a malformed Stripe-Signature header", async () => {
    await expect(
      verifyAndParseStripeEvent(samplePayload(), "not-a-valid-header", SECRET),
    ).rejects.toThrow(HttpError);
  });
});
