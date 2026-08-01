import { describe, expect, it } from "vitest";
import { computeStripeSignature, verifyStripeWebhook } from "./webhook";

const SECRET = "whsec_test_secret";
const TIMESTAMP = "1712000000";
const EVENT = { id: "evt_1", type: "invoice.paid", data: { object: { metadata: {} } } };
const BODY = JSON.stringify(EVENT);

async function signedHeader(body: string, secret = SECRET): Promise<string> {
  return `t=${TIMESTAMP},v1=${await computeStripeSignature(body, TIMESTAMP, secret)}`;
}

describe("verifyStripeWebhook", () => {
  it("returns the parsed event for a correctly signed payload", async () => {
    const event = await verifyStripeWebhook(BODY, await signedHeader(BODY), SECRET);
    expect(event).toEqual(EVENT);
  });

  it("accepts a header with extra scheme entries as long as one v1 matches", async () => {
    const v1 = await computeStripeSignature(BODY, TIMESTAMP, SECRET);
    const header = `t=${TIMESTAMP},v1=${"0".repeat(64)},v1=${v1},v0=legacy`;
    expect(await verifyStripeWebhook(BODY, header, SECRET)).toEqual(EVENT);
  });

  it("rejects a tampered body", async () => {
    const header = await signedHeader(BODY);
    const tampered = JSON.stringify({ ...EVENT, id: "evt_2" });
    expect(await verifyStripeWebhook(tampered, header, SECRET)).toBeNull();
  });

  it("rejects a signature made with the wrong secret", async () => {
    const header = await signedHeader(BODY, "whsec_other_secret");
    expect(await verifyStripeWebhook(BODY, header, SECRET)).toBeNull();
  });

  it("rejects a missing header", async () => {
    expect(await verifyStripeWebhook(BODY, null, SECRET)).toBeNull();
  });

  it("rejects a malformed header", async () => {
    expect(await verifyStripeWebhook(BODY, "not-a-signature", SECRET)).toBeNull();
    expect(await verifyStripeWebhook(BODY, `t=${TIMESTAMP}`, SECRET)).toBeNull();
    expect(await verifyStripeWebhook(BODY, "v1=deadbeef", SECRET)).toBeNull();
  });

  it("rejects everything when the secret is empty", async () => {
    expect(await verifyStripeWebhook(BODY, await signedHeader(BODY), "")).toBeNull();
  });

  it("rejects a correctly signed but non-JSON body", async () => {
    const body = "not json";
    expect(await verifyStripeWebhook(body, await signedHeader(body), SECRET)).toBeNull();
  });
});
