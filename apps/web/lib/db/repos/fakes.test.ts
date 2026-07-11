import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed-data";
import { createInMemoryRepositories } from "./fakes";
import type { Repositories } from "./types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("in-memory repositories", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    studioId = studio?.id ?? "";
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
  });

  it("lists members sorted by name", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((member) => member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(members.length).toBeGreaterThan(0);
  });

  it("finds a member by email within the studio", async () => {
    const found = await repos.members.findByEmail(studioId, "amara@example.com");
    expect(found?.name).toBe("Amara Okafor");
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();
  });

  it("filters sessions by an inclusive-from / exclusive-to range", async () => {
    const all = await repos.classSessions.listByStudio(studioId);
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(studioId, { from, to });
    expect(windowed.every((s) => s.startsAt >= from && s.startsAt < to)).toBe(true);
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("lists bookings across multiple session ids", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
  });

  it("inserts then reads back by id", async () => {
    const member = {
      id: "mem_new",
      studioId,
      name: "New Person",
      email: "new@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    await repos.members.insert(member);
    expect(await repos.members.getById("mem_new")).toEqual(member);
  });

  it("update returns an isolated clone (store not mutated by reference)", async () => {
    const members = await repos.members.listByStudio(studioId);
    const target = members[0];
    const updated = await repos.members.update(target.id, { status: "paused" });
    updated.status = "active"; // mutate the returned object
    const refetched = await repos.members.getById(target.id);
    expect(refetched?.status).toBe("paused");
  });

  it("classPackages: inserts then reads back by id", async () => {
    const members = await repos.members.listByStudio(studioId);
    const pkg = {
      id: "pkg_new",
      studioId,
      memberId: members[0].id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: NOW.toISOString(),
    };
    await repos.classPackages.insert(pkg);
    expect(await repos.classPackages.getById("pkg_new")).toEqual(pkg);
  });

  it("classPackages: listByMember returns only that member's packs, newest first", async () => {
    const members = await repos.members.listByStudio(studioId);
    const [member, other] = members;
    await repos.classPackages.insert({
      id: "pkg_older",
      studioId,
      memberId: member.id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2026-01-01T00:00:00.000Z",
    });
    await repos.classPackages.insert({
      id: "pkg_newer",
      studioId,
      memberId: member.id,
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
      status: "active",
      purchasedAt: "2026-02-01T00:00:00.000Z",
    });
    await repos.classPackages.insert({
      id: "pkg_other_member",
      studioId,
      memberId: other.id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2026-03-01T00:00:00.000Z",
    });
    const list = await repos.classPackages.listByMember(member.id);
    expect(list.map((p) => p.id)).toEqual(["pkg_newer", "pkg_older"]);
  });

  it("classPackages: update returns an isolated clone (store not mutated by reference)", async () => {
    const members = await repos.members.listByStudio(studioId);
    const inserted = await repos.classPackages.insert({
      id: "pkg_update",
      studioId,
      memberId: members[0].id,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: NOW.toISOString(),
    });
    const updated = await repos.classPackages.update(inserted.id, {
      creditsRemaining: 0,
      status: "refunded",
    });
    updated.status = "active"; // mutate the returned object
    const refetched = await repos.classPackages.getById(inserted.id);
    expect(refetched?.status).toBe("refunded");
    expect(refetched?.creditsRemaining).toBe(0);
  });

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });

  it("empty repositories return nulls / empty lists", async () => {
    const empty = createInMemoryRepositories();
    expect(await empty.studios.getFirst()).toBeNull();
    expect(await empty.members.listByStudio("x")).toEqual([]);
  });
});
