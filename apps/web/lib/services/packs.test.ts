import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPack, listPacks, refundPack } from "./packs";

function setup() {
  const now = new Date();
  const repos = createInMemoryRepositories(buildSeed(now));
  return { repos, now };
}

async function availableSession(repos: ReturnType<typeof createInMemoryRepositories>, memberId: string) {
  const sessions = await repos.classSessions.listByStudio((await repos.studios.getFirst())?.id ?? "");
  const bookings = await Promise.all(sessions.map((session) => repos.bookings.listBySession(session.id)));
  return sessions.find(
    (session, index) =>
      new Date(session.startsAt).getTime() > Date.now() &&
      !bookings[index].some((booking) => booking.memberId === memberId),
  );
}

async function memberAndStudio(repos: ReturnType<typeof createInMemoryRepositories>) {
  const studio = await repos.studios.getFirst();
  const members = studio ? await repos.members.listByStudio(studio.id) : [];
  return { studioId: studio?.id ?? "", memberId: members[0]?.id ?? "" };
}

describe("class pack service", () => {
  it("buys 5- and 10-credit packs at total prices", async () => {
    const { repos } = setup();
    const { studioId, memberId } = await memberAndStudio(repos);
    const five = await createPack(repos, studioId, { memberId, credits: 5 });
    const ten = await createPack(repos, studioId, { memberId, credits: 10 });
    expect(five).toMatchObject({ creditsRemaining: 5, priceCents: 5000, status: "active" });
    expect(ten).toMatchObject({ creditsRemaining: 10, priceCents: 10000, status: "active" });
  });

  it("lists packs newest first", async () => {
    const { repos } = setup();
    const { studioId, memberId } = await memberAndStudio(repos);
    const older = await createPack(repos, studioId, { memberId, credits: 5 });
    const newer = await createPack(repos, studioId, { memberId, credits: 10 });
    expect((await listPacks(repos, memberId)).map((pack) => pack.id)).toEqual([newer.id, older.id]);
  });

  it("draws from the oldest active pack when booking", async () => {
    const { repos } = setup();
    const { studioId, memberId } = await memberAndStudio(repos);
    const oldest = await createPack(repos, studioId, { memberId, credits: 5 });
    await createPack(repos, studioId, { memberId, credits: 10 });
    const session = await availableSession(repos, memberId);
    if (!session) throw new Error("Expected an available seeded session");
    const result = await createBooking(repos, createFakeProvider(), { sessionId: session.id, memberId });
    expect(result.status).toBe("booked");
    expect((await repos.classPacks.getById(oldest.id))?.creditsRemaining).toBe(4);
  });

  it("blocks a booking when every owned pack is exhausted or refunded", async () => {
    const { repos } = setup();
    const { studioId, memberId } = await memberAndStudio(repos);
    const pack = await createPack(repos, studioId, { memberId, credits: 5 });
    await repos.classPacks.update(pack.id, { creditsRemaining: 0 });
    const session = await availableSession(repos, memberId);
    if (!session) throw new Error("Expected an available seeded session");
    await expect(createBooking(repos, createFakeProvider(), { sessionId: session.id, memberId })).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
    expect(
      (await repos.bookings.listBySession(session.id)).filter(
        (booking) => booking.memberId === memberId,
      ),
    ).toHaveLength(0);
  });

  it("does not spend a second credit on a duplicate booking", async () => {
    const { repos } = setup();
    const { studioId, memberId } = await memberAndStudio(repos);
    const pack = await createPack(repos, studioId, { memberId, credits: 5 });
    const session = await availableSession(repos, memberId);
    if (!session) throw new Error("Expected an available seeded session");
    await createBooking(repos, createFakeProvider(), { sessionId: session.id, memberId });
    await expect(createBooking(repos, createFakeProvider(), { sessionId: session.id, memberId })).rejects.toMatchObject({
      status: 409,
    });
    expect((await repos.classPacks.getById(pack.id))?.creditsRemaining).toBe(4);
  });

  it("leaves no-pack members on the existing booking path", async () => {
    const { repos } = setup();
    const { memberId } = await memberAndStudio(repos);
    const session = await availableSession(repos, memberId);
    if (!session) throw new Error("Expected an available seeded session");
    const result = await createBooking(repos, createFakeProvider(), { sessionId: session.id, memberId });
    expect(result.status).toBe("booked");
    expect(await repos.classPacks.listByMember(memberId)).toEqual([]);
  });

  it("refunds and permanently voids a pack", async () => {
    const { repos } = setup();
    const { studioId, memberId } = await memberAndStudio(repos);
    const pack = await createPack(repos, studioId, { memberId, credits: 5 });
    const refunded = await refundPack(repos, pack.id);
    expect(refunded).toMatchObject({ creditsRemaining: 0, status: "refunded" });
    const session = await availableSession(repos, memberId);
    if (!session) throw new Error("Expected an available seeded session");
    await expect(createBooking(repos, createFakeProvider(), { sessionId: session.id, memberId })).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
  });
});
