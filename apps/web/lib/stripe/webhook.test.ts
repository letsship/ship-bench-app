import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { constructStripeEvent, StripeSignatureError } from "./webhook";

const SECRET = "whsec_test_secret";

function signPayload(body: string, timestamp: number = Math.floor(Date.now() / 1000)): string {
  const content = `${timestamp}.${body}`;
  const signature = createHmac("sha256", SECRET).update(content).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("constructStripeEvent", () => {
  it("parses and validates a correctly signed payload", () => {
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "inv_abc",
          },
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(body, timestamp);

    const event = constructStripeEvent(body, signature, SECRET);
    expect(event.id).toBe("evt_123");
    expect(event.type).toBe("invoice.paid");
    expect(event.data?.object?.metadata?.invoice_id).toBe("inv_abc");
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(body, timestamp);

    const tampered = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { tampered: true } },
    });

    expect(() => constructStripeEvent(tampered, signature, SECRET)).toThrow(StripeSignatureError);
    expect(() => constructStripeEvent(tampered, signature, SECRET)).toThrow("Invalid signature");
  });

  it("rejects with a wrong secret", () => {
    const body = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(body, timestamp);

    expect(() => constructStripeEvent(body, signature, "wrong_secret")).toThrow(
      StripeSignatureError,
    );
    expect(() => constructStripeEvent(body, signature, "wrong_secret")).toThrow(
      "Invalid signature",
    );
  });

  it("rejects a missing signature header", () => {
    const body = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });

    expect(() => constructStripeEvent(body, undefined, SECRET)).toThrow(StripeSignatureError);
    expect(() => constructStripeEvent(body, undefined, SECRET)).toThrow(
      "Missing Stripe-Signature header",
    );
  });

  it("rejects a missing secret", () => {
    const body = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(body, timestamp);

    expect(() => constructStripeEvent(body, signature, undefined)).toThrow(StripeSignatureError);
    expect(() => constructStripeEvent(body, signature, undefined)).toThrow(
      "Missing webhook signing secret",
    );
  });

  it("rejects a malformed signature header (missing timestamp)", () => {
    const body = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });
    const signature = "v1=abc123";

    expect(() => constructStripeEvent(body, signature, SECRET)).toThrow(StripeSignatureError);
    expect(() => constructStripeEvent(body, signature, SECRET)).toThrow("Missing timestamp");
  });

  it("rejects a malformed signature header (missing v1 signature)", () => {
    const body = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });
    const signature = "t=1234567890";

    expect(() => constructStripeEvent(body, signature, SECRET)).toThrow(StripeSignatureError);
    expect(() => constructStripeEvent(body, signature, SECRET)).toThrow("Missing v1 signature");
  });

  it("rejects a timestamp outside the tolerance window", () => {
    const body = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago, default tolerance is 300
    const signature = signPayload(body, oldTimestamp);

    expect(() => constructStripeEvent(body, signature, SECRET)).toThrow(StripeSignatureError);
    expect(() => constructStripeEvent(body, signature, SECRET)).toThrow(
      "Timestamp outside tolerance window",
    );
  });

  it("accepts a timestamp within the tolerance window", () => {
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_abc" } } },
    });
    const recentTimestamp = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago, within default tolerance
    const signature = signPayload(body, recentTimestamp);

    const event = constructStripeEvent(body, signature, SECRET);
    expect(event.id).toBe("evt_123");
  });

  it("accepts a custom tolerance window", () => {
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_abc" } } },
    });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 500;
    const signature = signPayload(body, oldTimestamp);

    const event = constructStripeEvent(body, signature, SECRET, { tolerance: 600 });
    expect(event.id).toBe("evt_123");
  });

  it("accepts an injected now function for deterministic testing", () => {
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_abc" } } },
    });
    const fakeNow = 1000;
    const timestamp = fakeNow - 100;
    const signature = signPayload(body, timestamp);

    const event = constructStripeEvent(body, signature, SECRET, {
      tolerance: 300,
      now: () => fakeNow,
    });
    expect(event.id).toBe("evt_123");
  });

  it("handles events with no metadata", () => {
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {},
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(body, timestamp);

    const event = constructStripeEvent(body, signature, SECRET);
    expect(event.data?.object?.metadata?.invoice_id).toBeUndefined();
  });

  it("rejects invalid JSON", () => {
    const body = "not valid json";
    const timestamp = Math.floor(Date.now() / 1000);
    const content = `${timestamp}.${body}`;
    const sig = createHmac("sha256", SECRET).update(content).digest("hex");
    const signature = `t=${timestamp},v1=${sig}`;

    expect(() => constructStripeEvent(body, signature, SECRET)).toThrow(StripeSignatureError);
    expect(() => constructStripeEvent(body, signature, SECRET)).toThrow("Invalid JSON");
  });
});
