import { describe, it, expect } from "vitest";
import {
  parseStripeSignatureHeader,
  verifyStripeSignature,
  invoiceIdFromEvent,
  parseStripeEvent,
  type StripeEvent,
} from "./stripe-webhook";

describe("stripe-webhook", () => {
  describe("parseStripeSignatureHeader", () => {
    it("parses valid header with t and v1", () => {
      const header = "t=1620000000,v1=somesignature";
      const result = parseStripeSignatureHeader(header);
      expect(result).toEqual({ t: "1620000000", v1: ["somesignature"] });
    });

    it("parses header with multiple v1 values", () => {
      const header = "t=1620000000,v1=sig1,v1=sig2";
      const result = parseStripeSignatureHeader(header);
      expect(result).toEqual({ t: "1620000000", v1: ["sig1", "sig2"] });
    });

    it("parses header with extra scheme fields", () => {
      const header = "t=1620000000,v1=signature,v0=old";
      const result = parseStripeSignatureHeader(header);
      expect(result).toEqual({ t: "1620000000", v1: ["signature"] });
    });

    it("returns null for missing t", () => {
      const header = "v1=signature";
      expect(parseStripeSignatureHeader(header)).toBeNull();
    });

    it("returns null for missing v1", () => {
      const header = "t=1620000000";
      expect(parseStripeSignatureHeader(header)).toBeNull();
    });

    it("returns null for malformed header", () => {
      const header = "invalid";
      expect(parseStripeSignatureHeader(header)).toBeNull();
    });
  });

  describe("verifyStripeSignature", () => {
    it("verifies a valid signature", async () => {
      const payload = '{"id":"test"}';
      const secret = "test-secret";
      const timestamp = "1620000000";

      // Compute the correct signature
      const encoder = new TextEncoder();
      const signedContent = `${timestamp}.${payload}`;
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
      const signature_hex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const header = `t=${timestamp},v1=${signature_hex}`;
      const isValid = await verifyStripeSignature(payload, header, secret);
      expect(isValid).toBe(true);
    });

    it("rejects invalid signature", async () => {
      const payload = '{"id":"test"}';
      const secret = "test-secret";
      const header = "t=1620000000,v1=invalidsignature";

      const isValid = await verifyStripeSignature(payload, header, secret);
      expect(isValid).toBe(false);
    });

    it("rejects signature with wrong secret", async () => {
      const payload = '{"id":"test"}';
      const secret = "test-secret";
      const timestamp = "1620000000";

      const encoder = new TextEncoder();
      const signedContent = `${timestamp}.${payload}`;
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
      const signature_hex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const header = `t=${timestamp},v1=${signature_hex}`;
      const isValid = await verifyStripeSignature(payload, header, "wrong-secret");
      expect(isValid).toBe(false);
    });

    it("rejects tampered payload", async () => {
      const payload = '{"id":"test"}';
      const secret = "test-secret";
      const timestamp = "1620000000";

      const encoder = new TextEncoder();
      const signedContent = `${timestamp}.${payload}`;
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
      const signature_hex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const header = `t=${timestamp},v1=${signature_hex}`;
      const tamperedPayload = '{"id":"test2"}';
      const isValid = await verifyStripeSignature(tamperedPayload, header, secret);
      expect(isValid).toBe(false);
    });

    it("rejects malformed header", async () => {
      const payload = '{"id":"test"}';
      const secret = "test-secret";
      const header = "invalid";

      const isValid = await verifyStripeSignature(payload, header, secret);
      expect(isValid).toBe(false);
    });
  });

  describe("invoiceIdFromEvent", () => {
    it("extracts invoice_id from metadata", () => {
      const event: StripeEvent = {
        id: "evt_123",
        type: "invoice.paid",
        data: {
          object: {
            metadata: {
              invoice_id: "inv_456",
            },
          },
        },
      };
      expect(invoiceIdFromEvent(event)).toBe("inv_456");
    });

    it("returns undefined when metadata is missing", () => {
      const event: StripeEvent = {
        id: "evt_123",
        type: "invoice.paid",
        data: {
          object: {},
        },
      };
      expect(invoiceIdFromEvent(event)).toBeUndefined();
    });

    it("returns undefined when invoice_id is missing", () => {
      const event: StripeEvent = {
        id: "evt_123",
        type: "invoice.paid",
        data: {
          object: {
            metadata: {},
          },
        },
      };
      expect(invoiceIdFromEvent(event)).toBeUndefined();
    });
  });

  describe("parseStripeEvent", () => {
    it("parses valid event", () => {
      const body = {
        id: "evt_123",
        type: "invoice.paid",
        data: { object: {} },
      };
      const event = parseStripeEvent(body);
      expect(event).toEqual(body);
    });

    it("returns null for missing id", () => {
      const body = { type: "invoice.paid", data: { object: {} } };
      expect(parseStripeEvent(body)).toBeNull();
    });

    it("returns null for missing type", () => {
      const body = { id: "evt_123", data: { object: {} } };
      expect(parseStripeEvent(body)).toBeNull();
    });

    it("returns null for missing data.object", () => {
      const body = { id: "evt_123", type: "invoice.paid" };
      expect(parseStripeEvent(body)).toBeNull();
    });
  });
});
