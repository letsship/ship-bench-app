import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  invoiceIdFromEvent,
  parseStripeSignatureHeader,
  signStripePayload,
  timingSafeEqual,
  verifyStripeWebhook,
} from "./stripe-webhook";

// Expected signatures are computed here with node:crypto (an independent
// implementation of what the module does with Web Crypto), so the tests need no
// live Stripe secret and would catch a drift in the signed-payload format.

const SECRET = "whsec_testsecret";
const TIMESTAMP = "1780000000";

const body = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({
    id: "evt_1",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: "inv_1" } } },
    ...over,
  });

const sign = (payload: string, secret = SECRET, timestamp = TIMESTAMP): string =>
  createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

const header = (payload: string, secret = SECRET, timestamp = TIMESTAMP): string =>
  `t=${timestamp},v1=${sign(payload, secret, timestamp)}`;

describe("signStripePayload", () => {
  it("matches an independently computed HMAC-SHA256 of `<t>.<body>`", async () => {
    const payload = body();
    expect(await signStripePayload(SECRET, TIMESTAMP, payload)).toBe(sign(payload));
  });
});

describe("parseStripeSignatureHeader", () => {
  it("reads the timestamp and every v1 candidate", () => {
    expect(parseStripeSignatureHeader("t=123,v1=aa,v0=zz,v1=bb")).toEqual({
      timestamp: "123",
      signatures: ["aa", "bb"],
    });
  });

  it("rejects a header without a timestamp or without any v1", () => {
    expect(parseStripeSignatureHeader("v1=aa")).toBeNull();
    expect(parseStripeSignatureHeader("t=123")).toBeNull();
    expect(parseStripeSignatureHeader("nonsense")).toBeNull();
    expect(parseStripeSignatureHeader("t=123,v1=")).toBeNull();
  });
});

describe("timingSafeEqual", () => {
  it("compares equal strings and rejects different ones", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("verifyStripeWebhook", () => {
  it("returns the parsed event for a correctly signed payload", async () => {
    const payload = body();
    const event = await verifyStripeWebhook({ payload, header: header(payload), secret: SECRET });
    expect(event).not.toBeNull();
    expect(event?.id).toBe("evt_1");
    expect(event?.type).toBe("invoice.paid");
    expect(invoiceIdFromEvent(event!)).toBe("inv_1");
  });

  it("accepts a header carrying several v1 signatures (secret rotation)", async () => {
    const payload = body();
    const rotated = `t=${TIMESTAMP},v1=${sign(payload, "whsec_old")},v1=${sign(payload)}`;
    expect(await verifyStripeWebhook({ payload, header: rotated, secret: SECRET })).not.toBeNull();
  });

  it("rejects a missing signature header", async () => {
    const payload = body();
    expect(await verifyStripeWebhook({ payload, header: null, secret: SECRET })).toBeNull();
  });

  it("rejects a malformed signature header", async () => {
    const payload = body();
    expect(
      await verifyStripeWebhook({ payload, header: "not-a-signature", secret: SECRET }),
    ).toBeNull();
  });

  it("rejects a payload signed with a different secret", async () => {
    const payload = body();
    expect(
      await verifyStripeWebhook({
        payload,
        header: header(payload, "whsec_attacker"),
        secret: SECRET,
      }),
    ).toBeNull();
  });

  it("rejects a body tampered with after signing", async () => {
    const signed = header(body());
    const tampered = body({ data: { object: { metadata: { invoice_id: "inv_other" } } } });
    expect(await verifyStripeWebhook({ payload: tampered, header: signed, secret: SECRET })).toBe(
      null,
    );
  });

  it("rejects a signature computed over a different timestamp", async () => {
    const payload = body();
    const skewed = `t=1780000001,v1=${sign(payload)}`;
    expect(await verifyStripeWebhook({ payload, header: skewed, secret: SECRET })).toBeNull();
  });

  it("rejects a correctly signed body that is not a Stripe event", async () => {
    const payload = JSON.stringify({ hello: "world" });
    expect(await verifyStripeWebhook({ payload, header: header(payload), secret: SECRET })).toBe(
      null,
    );
    const invalid = "{not json";
    expect(
      await verifyStripeWebhook({ payload: invalid, header: header(invalid), secret: SECRET }),
    ).toBeNull();
  });

  it("verifies an event that carries no invoice metadata", async () => {
    const payload = body({ type: "customer.created", data: { object: {} } });
    const event = await verifyStripeWebhook({ payload, header: header(payload), secret: SECRET });
    expect(event?.type).toBe("customer.created");
    expect(invoiceIdFromEvent(event!)).toBeNull();
  });
});
