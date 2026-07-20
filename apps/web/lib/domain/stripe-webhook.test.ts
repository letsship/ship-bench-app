import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "./stripe-webhook";

describe("verifyStripeSignature", () => {
  const secret = "whsec_test_secret_123";
  const payload = '{"id":"evt_123","type":"invoice.paid"}';
  const t = Math.floor(Date.now() / 1000).toString();

  // Compute a valid signature
  const signed = `${t}.${payload}`;
  const validSignature = createHmac("sha256", secret).update(signed).digest("hex");
  const validHeader = `t=${t},v1=${validSignature}`;

  it("accepts a correctly-signed payload", () => {
    const result = verifyStripeSignature({
      payload,
      header: validHeader,
      secret,
    });
    expect(result).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const tamperedPayload = '{"id":"evt_123","type":"invoice.paid","hacked":true}';
    const result = verifyStripeSignature({
      payload: tamperedPayload,
      header: validHeader,
      secret,
    });
    expect(result).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const result = verifyStripeSignature({
      payload,
      header: validHeader,
      secret: "wrong_secret",
    });
    expect(result).toBe(false);
  });

  it("rejects a malformed header", () => {
    const result = verifyStripeSignature({
      payload,
      header: "invalid_header_format",
      secret,
    });
    expect(result).toBe(false);
  });

  it("rejects a missing header", () => {
    const result = verifyStripeSignature({
      payload,
      header: undefined,
      secret,
    });
    expect(result).toBe(false);
  });

  it("rejects a missing secret", () => {
    const result = verifyStripeSignature({
      payload,
      header: validHeader,
      secret: undefined,
    });
    expect(result).toBe(false);
  });

  it("rejects an empty header", () => {
    const result = verifyStripeSignature({
      payload,
      header: "",
      secret,
    });
    expect(result).toBe(false);
  });
});
