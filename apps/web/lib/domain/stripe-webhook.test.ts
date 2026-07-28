import { describe, expect, it } from "vitest";
import { signStripePayload, verifyStripeSignature } from "./stripe-webhook";

const SECRET = "whsec_test_secret";
const PAYLOAD = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
const NOW_MS = 1_800_000_000_000;
const NOW_SECONDS = NOW_MS / 1000;

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed payload", () => {
    const header = signStripePayload(SECRET, PAYLOAD, NOW_SECONDS);
    expect(verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowMs: NOW_MS })).toBe(
      true,
    );
  });

  it("rejects a tampered payload", () => {
    const header = signStripePayload(SECRET, PAYLOAD, NOW_SECONDS);
    expect(
      verifyStripeSignature({ payload: `${PAYLOAD}x`, header, secret: SECRET, nowMs: NOW_MS }),
    ).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const header = signStripePayload("whsec_other", PAYLOAD, NOW_SECONDS);
    expect(verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowMs: NOW_MS })).toBe(
      false,
    );
  });

  it("rejects a missing header", () => {
    expect(
      verifyStripeSignature({ payload: PAYLOAD, header: null, secret: SECRET, nowMs: NOW_MS }),
    ).toBe(false);
  });

  it("rejects a malformed header", () => {
    expect(
      verifyStripeSignature({ payload: PAYLOAD, header: "nonsense", secret: SECRET, nowMs: NOW_MS }),
    ).toBe(false);
    expect(
      verifyStripeSignature({
        payload: PAYLOAD,
        header: `t=${NOW_SECONDS}`,
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toBe(false);
  });

  it("rejects a timestamp outside the tolerance", () => {
    const header = signStripePayload(SECRET, PAYLOAD, NOW_SECONDS - 3600);
    expect(verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowMs: NOW_MS })).toBe(
      false,
    );
  });

  it("accepts a timestamp just inside the tolerance", () => {
    const header = signStripePayload(SECRET, PAYLOAD, NOW_SECONDS - 299);
    expect(verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowMs: NOW_MS })).toBe(
      true,
    );
  });
});
