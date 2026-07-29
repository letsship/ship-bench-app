import { describe, expect, it } from "vitest";
import {
  buildStripeSignatureHeader,
  signStripePayload,
  verifyStripeSignature,
} from "./stripe-signature";

const SECRET = "whsec_test_secret";
const TIMESTAMP = "1700000000";
const BODY = JSON.stringify({
  id: "evt_123",
  type: "invoice.paid",
  data: { object: { metadata: { invoice_id: "inv_1" } } },
});

async function signedHeader(
  secret: string = SECRET,
  timestamp: string = TIMESTAMP,
  body: string = BODY,
): Promise<string> {
  return buildStripeSignatureHeader(timestamp, await signStripePayload(secret, timestamp, body));
}

describe("verifyStripeSignature", () => {
  it("accepts a signature produced with the correct secret", async () => {
    expect(await verifyStripeSignature(BODY, await signedHeader(), SECRET)).toBe(true);
  });

  it("rejects a signature produced with the wrong secret", async () => {
    const header = buildStripeSignatureHeader(
      TIMESTAMP,
      await signStripePayload("whsec_wrong", TIMESTAMP, BODY),
    );
    expect(await verifyStripeSignature(BODY, header, SECRET)).toBe(false);
  });

  it("rejects a tampered body", async () => {
    const header = await signedHeader();
    expect(await verifyStripeSignature(BODY + "tampered", header, SECRET)).toBe(false);
  });

  it("rejects a missing header", async () => {
    expect(await verifyStripeSignature(BODY, null, SECRET)).toBe(false);
    expect(await verifyStripeSignature(BODY, undefined, SECRET)).toBe(false);
    expect(await verifyStripeSignature(BODY, "", SECRET)).toBe(false);
  });

  it("rejects a malformed header missing v1", async () => {
    expect(await verifyStripeSignature(BODY, "t=1700000000", SECRET)).toBe(false);
  });

  it("rejects a malformed header missing t", async () => {
    const header = buildStripeSignatureHeader(
      TIMESTAMP,
      await signStripePayload(SECRET, TIMESTAMP, BODY),
    ).replace(/^t=\d+,/, "");
    expect(await verifyStripeSignature(BODY, header, SECRET)).toBe(false);
  });
});
