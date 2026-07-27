import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed, SEED_NOW } from "@/lib/db/seed-data";
import { __resetEnvCache } from "@/lib/env";

const NOW = SEED_NOW;
const SECRET = "test_stripe_webhook_secret";

describe("POST /api/webhooks/stripe", () => {
  let testRepos: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    testRepos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(testRepos);
    // Override the STRIPE_WEBHOOK_SECRET in the environment for testing
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    __resetEnvCache();
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
    __resetEnvCache();
  });

  it("rejects missing Stripe-Signature header with 400", async () => {
    const body = JSON.stringify({ id: "evt_test", type: "invoice.paid", data: { object: {} } });
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe("bad_request");
  });

  it("rejects invalid signature with 400", async () => {
    const body = JSON.stringify({ id: "evt_test", type: "invoice.paid", data: { object: {} } });
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "stripe-signature": "t=1234567890,v1=invalidsignature",
      },
      body,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe("bad_request");
  });
});
