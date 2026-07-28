import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { signStripePayload } from "@/lib/domain/stripe-webhook";
import { HttpError } from "@/lib/http";
import { processStripeWebhook } from "./stripe-webhooks";

const NOW = new Date("2026-07-01T12:00:00.000Z");
const NOW_MS = NOW.getTime();
const SECRET = "whsec_test_secret";

const openInvoice = async (repos: ReturnType<typeof createInMemoryRepositories>) => {
  const studio = await repos.studios.getFirst();
  if (!studio) throw new Error("seed must include a studio");
  const invoices = await repos.invoices.listByStudio(studio.id);
  const invoice = invoices.find((candidate) => candidate.status === "open");
  if (!invoice) throw new Error("seed must include an open invoice");
  return invoice;
};

const invoicePaidPayload = (invoiceId: string) =>
  JSON.stringify({
    id: "evt_1",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });

describe("processStripeWebhook", () => {
  it("rejects a missing signature with 400 and changes nothing", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const invoice = await openInvoice(repos);
    await expect(
      processStripeWebhook(repos, {
        payload: invoicePaidPayload(invoice.id),
        signatureHeader: null,
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await repos.invoices.getById(invoice.id))?.status).toBe("open");
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const invoice = await openInvoice(repos);
    const payload = invoicePaidPayload(invoice.id);
    const forged = signStripePayload("whsec_wrong", payload, NOW_MS / 1000);
    await expect(
      processStripeWebhook(repos, {
        payload,
        signatureHeader: forged,
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).rejects.toBeInstanceOf(HttpError);
    expect((await repos.invoices.getById(invoice.id))?.status).toBe("open");
  });

  it("marks the named invoice paid on a verified invoice.paid event", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const invoice = await openInvoice(repos);
    const payload = invoicePaidPayload(invoice.id);
    const signature = signStripePayload(SECRET, payload, NOW_MS / 1000);
    await processStripeWebhook(repos, {
      payload,
      signatureHeader: signature,
      secret: SECRET,
      nowMs: NOW_MS,
    });
    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBe(NOW.toISOString());
  });

  it("is idempotent: replaying the same event keeps the invoice paid once", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const invoice = await openInvoice(repos);
    const payload = invoicePaidPayload(invoice.id);
    const signature = signStripePayload(SECRET, payload, NOW_MS / 1000);
    const input = { payload, signatureHeader: signature, secret: SECRET, nowMs: NOW_MS };
    await processStripeWebhook(repos, input);
    // Replay with a later clock: a duplicate must not overwrite paidAt.
    await processStripeWebhook(repos, { ...input, nowMs: NOW_MS + 60_000 });
    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBe(NOW.toISOString());
  });

  it("acknowledges an unknown invoice without changing anything", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const payload = invoicePaidPayload("inv_does_not_exist");
    const signature = signStripePayload(SECRET, payload, NOW_MS / 1000);
    await expect(
      processStripeWebhook(repos, {
        payload,
        signatureHeader: signature,
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).resolves.toEqual({ received: true });
  });

  it("acknowledges other event types without changing anything", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const invoice = await openInvoice(repos);
    const payload = JSON.stringify({
      id: "evt_2",
      type: "customer.created",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });
    const signature = signStripePayload(SECRET, payload, NOW_MS / 1000);
    await processStripeWebhook(repos, {
      payload,
      signatureHeader: signature,
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect((await repos.invoices.getById(invoice.id))?.status).toBe("open");
  });
});
