import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ email: "operator@example.com" })),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

function isolationRepositories(): Repositories {
  const seed = buildSeed(new Date());
  const memberId = seed.members[0].id;
  const ownSession = {
    ...seed.sessions[0],
    id: "own-session",
    startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString(),
  };
  const foreignMember = { ...seed.members[1], id: "foreign-member", studioId: "s2" };
  const foreignSession = { ...seed.sessions[1], id: "foreign-session", studioId: "s2" };
  return createInMemoryRepositories({
    ...seed,
    members: [...seed.members, foreignMember],
    sessions: [...seed.sessions, ownSession, foreignSession],
    bookings: [
      ...seed.bookings,
      { ...seed.bookings[0], id: "own-booking", sessionId: ownSession.id, memberId },
      {
        ...seed.bookings[1],
        id: "foreign-booking",
        sessionId: foreignSession.id,
        memberId: foreignMember.id,
        status: "booked",
        cancelledAt: null,
      },
    ],
    invoices: [
      ...seed.invoices,
      { ...seed.invoices[0], id: "foreign-invoice", studioId: "s2", memberId: foreignMember.id },
    ],
  });
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });

  it("GET detail routes hide foreign records and return own records", async () => {
    const repos = isolationRepositories();
    __setTestRepositories(repos);
    const ownInvoice = (await repos.invoices.listByStudio((await repos.studios.getFirst())!.id))[0];
    const ownMember = (await repos.members.listByStudio((await repos.studios.getFirst())!.id))[0];

    expect((await invoiceDetailGet(new Request("http://localhost"), routeParams("foreign-invoice"))).status).toBe(404);
    expect((await invoiceDetailGet(new Request("http://localhost"), routeParams(ownInvoice.id))).status).toBe(200);
    expect((await memberDetailGet(new Request("http://localhost"), routeParams("foreign-member"))).status).toBe(404);
    expect((await memberDetailGet(new Request("http://localhost"), routeParams(ownMember.id))).status).toBe(200);
  });

  it("DELETE /api/bookings/:id hides foreign bookings and cancels own bookings", async () => {
    const repos = isolationRepositories();
    __setTestRepositories(repos);

    expect((await bookingDelete(new Request("http://localhost"), routeParams("foreign-booking"))).status).toBe(404);
    expect((await repos.bookings.getById("foreign-booking"))?.status).toBe("booked");
    expect((await bookingDelete(new Request("http://localhost"), routeParams("own-booking"))).status).toBe(200);
    expect((await repos.bookings.getById("own-booking"))?.status).toBe("cancelled");
  });
});
