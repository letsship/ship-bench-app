import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./webhook";

describe("verifyStripeSignature", () => {
  it("verifies a correctly-signed payload", async () => {
    const secret = "test_secret_123";
    const timestamp = "1234567890";
    const rawBody = '{"id":"evt_123","type":"invoice.paid"}';

    const encoder = new TextEncoder();
    const signedContent = `${timestamp}.${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
    const hexSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const header = `t=${timestamp},v1=${hexSignature}`;
    const result = await verifyStripeSignature(rawBody, header, secret);
    expect(result).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const secret = "test_secret_123";
    const timestamp = "1234567890";
    const rawBody = '{"id":"evt_123","type":"invoice.paid"}';

    const encoder = new TextEncoder();
    const signedContent = `${timestamp}.${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
    const hexSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const header = `t=${timestamp},v1=${hexSignature}`;
    const tamperedBody = '{"id":"evt_123","type":"invoice.paid","extra":"field"}';
    const result = await verifyStripeSignature(tamperedBody, header, secret);
    expect(result).toBe(false);
  });

  it("rejects with a wrong secret", async () => {
    const secret = "test_secret_123";
    const wrongSecret = "wrong_secret";
    const timestamp = "1234567890";
    const rawBody = '{"id":"evt_123","type":"invoice.paid"}';

    const encoder = new TextEncoder();
    const signedContent = `${timestamp}.${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
    const hexSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const header = `t=${timestamp},v1=${hexSignature}`;
    const result = await verifyStripeSignature(rawBody, header, wrongSecret);
    expect(result).toBe(false);
  });

  it("rejects a malformed header", async () => {
    const secret = "test_secret_123";
    const rawBody = '{"id":"evt_123","type":"invoice.paid"}';

    const result = await verifyStripeSignature(rawBody, "invalid_header", secret);
    expect(result).toBe(false);
  });

  it("rejects when secret is undefined", async () => {
    const rawBody = '{"id":"evt_123","type":"invoice.paid"}';
    const header = "t=1234567890,v1=somehash";

    const result = await verifyStripeSignature(rawBody, header, undefined);
    expect(result).toBe(false);
  });

  it("verifies against multiple v1 signatures and accepts the first match", async () => {
    const secret = "test_secret_123";
    const timestamp = "1234567890";
    const rawBody = '{"id":"evt_123","type":"invoice.paid"}';

    const encoder = new TextEncoder();
    const signedContent = `${timestamp}.${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
    const hexSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const header = `t=${timestamp},v1=wrongsignature1,v1=${hexSignature},v1=wrongsignature2`;
    const result = await verifyStripeSignature(rawBody, header, secret);
    expect(result).toBe(true);
  });
});
