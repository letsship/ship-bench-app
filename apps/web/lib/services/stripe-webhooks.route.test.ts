import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

const SECRET = "whsec_route";
const NOW = new Date("2026-03-15T12:00:00.000Z");

let repos: Repositories;
let openId: string;

const post = (body: string, header?: string) =>
  POST(
    new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: header ? { "stripe-signature": header } : {},
    }),
  );

const sign = (payload: string, secret = SECRET) =>
  `t=1780000000,v1=${createHmac("sha256", secret).update(`1780000000.${payload}`).digest("hex")}`;

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const seed = buildSeed(NOW);
    openId = seed.invoices.find((i) => i.status === "open")!.id;
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("400s a missing signature and changes nothing", async () => {
    const body = JSON.stringify({
      id: "e1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: openId } } },
    });
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(openId))?.status).toBe("open");
  });

  it("400s a wrong signature", async () => {
    const body = JSON.stringify({
      id: "e1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: openId } } },
    });
    const res = await post(body, sign(body, "whsec_other"));
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(openId))?.status).toBe("open");
  });

  it("400s when the secret is unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const body = JSON.stringify({
      id: "e1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: openId } } },
    });
    expect((await post(body, sign(body))).status).toBe(400);
  });

  it("200s a verified invoice.paid, marks it paid, and is idempotent", async () => {
    const body = JSON.stringify({
      id: "e1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: openId } } },
    });
    const first = await post(body, sign(body));
    expect(first.status).toBe(200);
    const invoice = await repos.invoices.getById(openId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeTruthy();

    const second = await post(body, sign(body));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ outcome: "duplicate" });
    expect((await repos.invoices.getById(openId))?.paidAt).toBe(invoice?.paidAt);
  });

  it("200s an unknown invoice and another event type", async () => {
    const a = JSON.stringify({
      id: "e2",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "nope" } } },
    });
    expect((await post(a, sign(a))).status).toBe(200);
    const b = JSON.stringify({ id: "e3", type: "charge.refunded", data: { object: {} } });
    expect((await post(b, sign(b))).status).toBe(200);
    expect((await repos.invoices.getById(openId))?.status).toBe("open");
  });
});
