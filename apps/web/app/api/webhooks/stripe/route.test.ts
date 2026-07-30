import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice } from "@/lib/db/types";

const SECRET = "whsec_test_secret";
const NOW = new Date("2026-03-15T12:00:00.000Z").toISOString();

function invoice(id: string, over: Partial<Invoice> = {}): Invoice {
  return {
    id,
    studioId: "s1",
    memberId: "m1",
    number: `INV-2026-${id}`,
    status: "open",
    currency: "EUR",
    taxRateBps: 0,
    subtotalCents: 1000,
    taxCents: 0,
    totalCents: 1000,
    issuedAt: NOW,
    dueAt: null,
    paidAt: null,
    createdAt: NOW,
    ...over,
  };
}

function seed(invoices: Invoice[]): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: NOW },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices,
    lineItems: [],
    outbox: [],
  };
}

async function sign(payload: string, secret: string, timestamp = "1700000000"): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

// Build a request whose body is the EXACT bytes the signature was computed over.
function webhook(payload: string, signature: string | null): Request {
  const req = new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });
  if (signature !== null) req.headers.set("stripe-signature", signature);
  return req;
}

const paidEvent = (invoiceId: string, id = "evt_1") => ({
  id,
  type: "invoice.paid",
  data: { object: { metadata: { invoice_id: invoiceId } } },
});

async function currentInvoice(): Promise<Invoice | null> {
  const { resolveRepositories } = await import("@/lib/db/repos");
  const repos = await resolveRepositories();
  return repos.invoices.getById("inv_1");
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    __setTestRepositories(createInMemoryRepositories(seed([invoice("inv_1")])));
  });
  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects a missing signature with 400 and changes nothing", async () => {
    const res = await POST(webhook(JSON.stringify(paidEvent("inv_1")), null));
    expect(res.status).toBe(400);
    const inv = await currentInvoice();
    expect(inv?.status).toBe("open");
    expect(inv?.paidAt).toBeNull();
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const res = await POST(webhook(JSON.stringify(paidEvent("inv_1")), "t=1,v1=deadbeef"));
    expect(res.status).toBe(400);
    const inv = await currentInvoice();
    expect(inv?.status).toBe("open");
    expect(inv?.paidAt).toBeNull();
  });

  it("marks the invoice paid on a verified invoice.paid event (200)", async () => {
    const payload = JSON.stringify(paidEvent("inv_1"));
    const res = await POST(webhook(payload, await sign(payload, SECRET)));
    expect(res.status).toBe(200);
    const inv = await currentInvoice();
    expect(inv?.status).toBe("paid");
    expect(inv?.paidAt).not.toBeNull();
  });

  it("is idempotent: the same event delivered twice is paid exactly once", async () => {
    const payload = JSON.stringify(paidEvent("inv_1", "evt_dup"));
    const signature = await sign(payload, SECRET);
    const res1 = await POST(webhook(payload, signature));
    const res2 = await POST(webhook(payload, signature));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const inv = await currentInvoice();
    expect(inv?.status).toBe("paid");
    expect(inv?.paidAt).not.toBeNull();
  });

  it("acknowledges a verified event naming an unknown invoice (200, no change)", async () => {
    const payload = JSON.stringify(paidEvent("inv_missing"));
    const res = await POST(webhook(payload, await sign(payload, SECRET)));
    expect(res.status).toBe(200);
    const inv = await currentInvoice();
    expect(inv?.status).toBe("open");
    expect(inv?.paidAt).toBeNull();
  });

  it("acknowledges a verified non-invoice.paid event (200, no change)", async () => {
    const payload = JSON.stringify({
      id: "evt_other",
      type: "invoice.payment_failed",
      data: { object: { metadata: { invoice_id: "inv_1" } } },
    });
    const res = await POST(webhook(payload, await sign(payload, SECRET)));
    expect(res.status).toBe(200);
    const inv = await currentInvoice();
    expect(inv?.status).toBe("open");
    expect(inv?.paidAt).toBeNull();
  });
});
