import { describe, expect, it } from "vitest";
import {
  computeStripeSignature,
  extractInvoiceId,
  isInvoicePaidEvent,
  parseStripeSignatureHeader,
  verifyStripeSignature,
} from "./stripe-webhook";

const SECRET = "whsec_test_secret";
const TIMESTAMP = "1774526400";
const PAYLOAD = JSON.stringify({
  id: "evt_1",
  type: "invoice.paid",
  data: { object: { metadata: { invoice_id: "inv_1" } } },
});

async function signedHeader(payload: string, secret = SECRET): Promise<string> {
  const signature = await computeStripeSignature({ payload, timestamp: TIMESTAMP, secret });
  return `t=${TIMESTAMP},v1=${signature}`;
}

describe("parseStripeSignatureHeader", () => {
  it("splits the timestamp and every v1 signature", () => {
    expect(parseStripeSignatureHeader("t=123,v1=aaa,v1=bbb,v0=ccc")).toEqual({
      timestamp: "123",
      signatures: ["aaa", "bbb"],
    });
  });

  it("returns null for a missing, empty, or incomplete header", () => {
    expect(parseStripeSignatureHeader(null)).toBeNull();
    expect(parseStripeSignatureHeader("")).toBeNull();
    expect(parseStripeSignatureHeader("t=123")).toBeNull();
    expect(parseStripeSignatureHeader("v1=aaa")).toBeNull();
    expect(parseStripeSignatureHeader("garbage")).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  it("accepts a payload signed with our secret", async () => {
    const header = await signedHeader(PAYLOAD);
    expect(await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET })).toBe(true);
  });

  it("accepts a header carrying several v1 signatures if one matches", async () => {
    const signature = await computeStripeSignature({
      payload: PAYLOAD,
      timestamp: TIMESTAMP,
      secret: SECRET,
    });
    const header = `t=${TIMESTAMP},v1=${"0".repeat(64)},v1=${signature}`;
    expect(await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET })).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const header = await signedHeader(PAYLOAD);
    const tampered = PAYLOAD.replace("inv_1", "inv_2");
    expect(await verifyStripeSignature({ payload: tampered, header, secret: SECRET })).toBe(false);
  });

  it("rejects a signature made with a different secret", async () => {
    const header = await signedHeader(PAYLOAD, "whsec_other_secret");
    expect(await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET })).toBe(false);
  });

  it("rejects a replayed signature bound to a different timestamp", async () => {
    const signature = await computeStripeSignature({
      payload: PAYLOAD,
      timestamp: TIMESTAMP,
      secret: SECRET,
    });
    const header = `t=9999999999,v1=${signature}`;
    expect(await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET })).toBe(false);
  });

  it("rejects a malformed or missing header", async () => {
    expect(await verifyStripeSignature({ payload: PAYLOAD, header: "nope", secret: SECRET })).toBe(
      false,
    );
    expect(await verifyStripeSignature({ payload: PAYLOAD, header: null, secret: SECRET })).toBe(
      false,
    );
  });

  it("rejects everything when no secret is configured", async () => {
    const header = await signedHeader(PAYLOAD);
    expect(await verifyStripeSignature({ payload: PAYLOAD, header, secret: undefined })).toBe(
      false,
    );
    expect(await verifyStripeSignature({ payload: PAYLOAD, header, secret: "" })).toBe(false);
  });
});

describe("event selectors", () => {
  const event = {
    id: "evt_1",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: "inv_1" } } },
  };

  it("recognises invoice.paid only", () => {
    expect(isInvoicePaidEvent(event)).toBe(true);
    expect(isInvoicePaidEvent({ type: "invoice.payment_failed" })).toBe(false);
  });

  it("reads the invoice id from the object metadata", () => {
    expect(extractInvoiceId(event)).toBe("inv_1");
    expect(extractInvoiceId({ ...event, data: { object: {} } })).toBeNull();
    expect(extractInvoiceId({ ...event, data: { object: { metadata: {} } } })).toBeNull();
  });
});
