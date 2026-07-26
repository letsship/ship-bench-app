import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as membersGet } from "@/app/api/members/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("[id] route handlers resolve an async params Promise (Next 16)", () => {
  let seed: ReturnType<typeof buildSeed>;

  beforeEach(() => {
    seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/members/:id resolves when params is a Promise", async () => {
    const member = seed.members[0];
    const res = await membersGet(new Request(`http://localhost/api/members/${member.id}`), {
      params: Promise.resolve({ id: member.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(member.id);
  });

  it("GET /api/invoices/:id resolves when params is a Promise", async () => {
    const invoice = seed.invoices[0];
    const res = await invoicesGet(new Request(`http://localhost/api/invoices/${invoice.id}`), {
      params: Promise.resolve({ id: invoice.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: { id: string } };
    expect(body.invoice.id).toBe(invoice.id);
  });
});
