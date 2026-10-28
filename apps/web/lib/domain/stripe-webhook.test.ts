import { describe, it, expect } from "vitest";
import {
  verifyStripeSignature,
  parseStripeSignatureHeader,
  getInvoiceIdFromEvent,
} from "./stripe-webhook";

const encoder = new TextEncoder();

async function computeSignature(
  timestamp: string,
  payload: string,
  secret: string,
): Promise<string> {
  const message = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("parseStripeSignatureHeader", () => {
  it("parses a valid header", () => {
    const result = parseStripeSignatureHeader("t=1614556800,v1=signature123");
    expect(result).toEqual({ timestamp: "1614556800", signature: "signature123" });
  });

  it("returns null for missing header", () => {
    expect(parseStripeSignatureHeader(undefined)).toBeNull();
  });

  it("returns null for empty header", () => {
    expect(parseStripeSignatureHeader("")).toBeNull();
  });

  it("returns null for malformed header", () => {
    expect(parseStripeSignatureHeader("invalid")).toBeNull();
  });

  it("returns null if t or v1 missing", () => {
    expect(parseStripeSignatureHeader("t=123")).toBeNull();
    expect(parseStripeSignatureHeader("v1=sig")).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  it("verifies a valid signature", async () => {
    const timestamp = "1614556800";
    const payload = '{"id":"evt_123","type":"invoice.paid"}';
    const secret = "whsec_test123";
    const signature = await computeSignature(timestamp, payload, secret);
    const header = `t=${timestamp},v1=${signature}`;

    const valid = await verifyStripeSignature(payload, header, secret);
    expect(valid).toBe(true);
  });

  it("rejects an invalid signature", async () => {
    const timestamp = "1614556800";
    const payload = '{"id":"evt_123","type":"invoice.paid"}';
    const secret = "whsec_test123";

    const valid = await verifyStripeSignature(payload, `t=${timestamp},v1=wrongsignature`, secret);
    expect(valid).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const timestamp = "1614556800";
    const payload = '{"id":"evt_123","type":"invoice.paid"}';
    const secret = "whsec_test123";
    const signature = await computeSignature(timestamp, payload, secret);
    const header = `t=${timestamp},v1=${signature}`;

    const valid = await verifyStripeSignature(
      '{"id":"evt_123","type":"invoice.paid","tampered":true}',
      header,
      secret,
    );
    expect(valid).toBe(false);
  });

  it("rejects missing signature header", async () => {
    const valid = await verifyStripeSignature('{"id":"evt_123"}', undefined, "secret");
    expect(valid).toBe(false);
  });

  it("rejects wrong secret", async () => {
    const timestamp = "1614556800";
    const payload = '{"id":"evt_123","type":"invoice.paid"}';
    const secret = "whsec_test123";
    const signature = await computeSignature(timestamp, payload, secret);
    const header = `t=${timestamp},v1=${signature}`;

    const valid = await verifyStripeSignature(payload, header, "wrong_secret");
    expect(valid).toBe(false);
  });
});

describe("getInvoiceIdFromEvent", () => {
  it("extracts invoice_id from event", () => {
    const event = {
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_456" } } },
    };
    expect(getInvoiceIdFromEvent(event)).toBe("inv_456");
  });

  it("returns null if invoice_id missing", () => {
    const event = {
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: {} } },
    };
    expect(getInvoiceIdFromEvent(event)).toBeNull();
  });

  it("returns null if metadata missing", () => {
    const event = {
      id: "evt_123",
      type: "invoice.paid",
      data: { object: {} },
    };
    expect(getInvoiceIdFromEvent(event)).toBeNull();
  });

  it("returns null if data.object missing", () => {
    const event = { id: "evt_123", type: "invoice.paid", data: {} };
    expect(getInvoiceIdFromEvent(event)).toBeNull();
  });

  it("returns null if data missing", () => {
    const event = { id: "evt_123", type: "invoice.paid" };
    expect(getInvoiceIdFromEvent(event)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(getInvoiceIdFromEvent(null)).toBeNull();
    expect(getInvoiceIdFromEvent("string")).toBeNull();
    expect(getInvoiceIdFromEvent(123)).toBeNull();
  });
});
