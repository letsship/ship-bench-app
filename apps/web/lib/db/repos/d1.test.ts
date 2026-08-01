import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { buildSeed } from "../seed-data";
import * as schema from "../schema";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function chunks<T>(rows: T[], size = 10): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );
}

describe("D1 repositories", () => {
  let miniflare: Miniflare;
  let repos: Repositories;
  let studioId: string;

  beforeAll(async () => {
    miniflare = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('ok'); } }",
      d1Databases: ["DB"],
    });
    const binding = (await miniflare.getD1Database("DB")) as unknown as D1Database;
    const migration = await readFile(
      new URL("../../../migrations/0001_init.sql", import.meta.url),
      "utf8",
    );
    const statements = migration
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await binding.prepare(statement).run();

    const seed = buildSeed(NOW);
    const db = drizzle(binding, { schema });
    await db.insert(schema.studios).values(seed.studio);
    await db.insert(schema.studioSettings).values(seed.settings);
    await db.insert(schema.members).values(seed.members);
    await db.insert(schema.classTypes).values(seed.classTypes);
    for (const rows of chunks(seed.sessions)) await db.insert(schema.classSessions).values(rows);
    for (const rows of chunks(seed.bookings)) await db.insert(schema.bookings).values(rows);
    await db.insert(schema.invoices).values(seed.invoices);
    await db.insert(schema.invoiceLineItems).values(seed.lineItems);
    await db.insert(schema.notificationOutbox).values(seed.outbox);

    repos = createD1Repositories(binding);
    studioId = seed.studio.id;
  });

  afterAll(async () => {
    await miniflare.dispose();
  });

  it("returns the seeded studio and settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.id).toBe(studioId);
    expect(await repos.settings.getByStudioId(studioId)).toMatchObject({
      studioId,
      waitlistEnabled: true,
      notifyInvoices: true,
    });
  });

  it("lists members sorted by name and finds by email", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((member) => member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect((await repos.members.findByEmail(studioId, "amara@example.com"))?.name).toBe(
      "Amara Okafor",
    );
    expect(await repos.members.findByEmail(studioId, "nobody@example.com")).toBeNull();
  });

  it("filters sessions by an inclusive-from and exclusive-to range", async () => {
    const all = await repos.classSessions.listByStudio(studioId);
    const from = all[3].startsAt;
    const to = all[all.length - 2].startsAt;
    const windowed = await repos.classSessions.listByStudio(studioId, { from, to });
    expect(windowed.every((session) => session.startsAt >= from && session.startsAt < to)).toBe(
      true,
    );
    expect(windowed.length).toBeLessThan(all.length);
  });

  it("orders invoices newest first and counts them", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const issuedAt = invoices.map((invoice) => invoice.issuedAt);
    expect(issuedAt).toEqual([...issuedAt].sort((a, b) => b.localeCompare(a)));
    expect(await repos.invoices.countByStudio(studioId)).toBe(invoices.length);
  });

  it("short-circuits empty multi-row operations", async () => {
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
  });

  it("lists only pending outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
  });

  it("round-trips inserts and updates", async () => {
    const member = {
      id: "mem_d1_new",
      studioId,
      name: "D1 Person",
      email: "d1@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    expect(await repos.members.insert(member)).toEqual(member);
    expect(await repos.members.getById(member.id)).toEqual(member);
    expect(await repos.members.update(member.id, { status: "paused" })).toEqual({
      ...member,
      status: "paused",
    });
  });

  it("returns null for absent rows", async () => {
    expect(await repos.members.getById("missing")).toBeNull();
    expect(await repos.classTypes.getById("missing")).toBeNull();
    expect(await repos.classSessions.getById("missing")).toBeNull();
    expect(await repos.bookings.getById("missing")).toBeNull();
    expect(await repos.invoices.getById("missing")).toBeNull();
  });
});
