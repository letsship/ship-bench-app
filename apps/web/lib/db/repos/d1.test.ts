import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import * as schema from "../schema";
import { buildSeed, SEED_NOW } from "../seed-data";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

// Conformance spec for the D1/Drizzle repository adapter. It spins up a REAL
// in-process D1 (Miniflare), applies the shipped `migrations/0001_init.sql`
// from scratch, seeds it through the adapter (plus a direct insert for the
// studio + settings rows, which have no repository insert method), then
// asserts the SAME behaviours the in-memory fakes are checked for. Proves the
// Drizzle implementation satisfies the `Repositories` seam against a genuine
// D1 database, not just the in-memory store.

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = resolve(HERE, "../../../migrations/0001_init.sql");

// D1's `exec` chokes on comment-only lines and multi-line statements, so split
// the migration into individual statements (stripping `--` comments) and run
// each through `prepare().run()`. The migration has no string literals
// containing `;`, so a naive `;` split is safe here.
function splitStatements(raw: string): string[] {
  const noComments = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return noComments
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

async function applyMigration(d1: D1Database): Promise<void> {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  for (const stmt of splitStatements(sql)) {
    await d1.prepare(stmt).run();
  }
}

interface Harness {
  d1: D1Database;
  repos: Repositories;
  dispose: () => Promise<void>;
}

async function bootD1(): Promise<Harness> {
  const mf = new Miniflare({
    modules: [
      { type: "ESModule", path: "src.js", contents: "export default { fetch() { return new Response('ok'); } }" },
    ],
    d1Databases: ["DB"],
    compatibilityDate: "2025-06-01",
  });
  const d1 = await mf.getD1Database("DB");
  return { d1, repos: createD1Repositories(d1), dispose: () => mf.dispose() };
}

// Studio + studio_settings have no repository insert method, so seed them
// directly via Drizzle (same D1 binding the adapter wraps).
async function seed(harness: Harness): Promise<void> {
  const seed = buildSeed(SEED_NOW);
  const db = drizzle(harness.d1, { schema });
  await db.insert(schema.studios).values(seed.studio).run();
  await db.insert(schema.studioSettings).values(seed.settings).run();
  for (const member of seed.members) await harness.repos.members.insert(member);
  for (const classType of seed.classTypes) await harness.repos.classTypes.insert(classType);
  for (const session of seed.sessions) await harness.repos.classSessions.insert(session);
  for (const booking of seed.bookings) await harness.repos.bookings.insert(booking);
  for (const invoice of seed.invoices) await harness.repos.invoices.insert(invoice);
  await harness.repos.invoiceLineItems.insertMany(seed.lineItems);
  for (const row of seed.outbox) await harness.repos.outbox.insert(row);
}

describe("D1 repositories (Drizzle)", () => {
  let harness: Harness;
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    harness = await bootD1();
    await applyMigration(harness.d1);
    await seed(harness);
    repos = harness.repos;
    const studio = await repos.studios.getFirst();
    studioId = studio?.id ?? "";
  });

  afterEach(async () => {
    await harness.dispose();
  });

  it("returns the seeded studio + settings", async () => {
    const studio = await repos.studios.getFirst();
    expect(studio?.name).toBe("Riverbank Movement");
    const settings = await repos.settings.getByStudioId(studioId);
    expect(settings?.currency).toBe("EUR");
    expect(settings?.waitlistEnabled).toBe(true);
  });

  it("lists members sorted by name", async () => {
    const members = await repos.members.listByStudio(studioId);
    const names = members.map((member) => member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(members.length).toBeGreaterThan(0);
    // Booleans round-trip as real booleans (Drizzle integer mode).
    expect(typeof members[0].notificationsOptedOut).toBe("boolean");
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
    expect(windowed).toEqual(
      [...windowed].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  });

  it("lists bookings across multiple session ids", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const ids = sessions.slice(0, 3).map((s) => s.id);
    const bookings = await repos.bookings.listBySessionIds(ids);
    expect(bookings.every((b) => ids.includes(b.sessionId))).toBe(true);
  });

  it("short-circuits listBySessionIds and insertMany on empty input", async () => {
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
    expect(await repos.invoiceLineItems.insertMany([])).toEqual([]);
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
      createdAt: SEED_NOW.toISOString(),
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

  it("counts invoices for the studio", async () => {
    const count = await repos.invoices.countByStudio(studioId);
    const list = await repos.invoices.listByStudio(studioId);
    expect(count).toBe(list.length);
  });

  it("lists invoices ordered by issued_at descending", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const issued = invoices.map((i) => i.issuedAt);
    expect(issued).toEqual([...issued].sort((a, b) => b.localeCompare(a)));
  });

  it("listPending returns only unsent outbox rows", async () => {
    const pending = await repos.outbox.listPending();
    expect(pending.every((row) => row.sentAt === null)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("reads invoice line items for an invoice", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const items = await repos.invoiceLineItems.listByInvoice(invoices[0].id);
    expect(items.length).toBeGreaterThan(0);
    expect(typeof items[0].refunded).toBe("boolean");
  });

  it("empty database returns nulls / empty lists", async () => {
    const empty = await bootD1();
    try {
      await applyMigration(empty.d1);
      expect(await empty.repos.studios.getFirst()).toBeNull();
      expect(await empty.repos.members.listByStudio("x")).toEqual([]);
      expect(await empty.repos.classSessions.listByStudio("x")).toEqual([]);
      expect(await empty.repos.invoices.countByStudio("x")).toBe(0);
      expect(await empty.repos.outbox.listPending()).toEqual([]);
    } finally {
      await empty.dispose();
    }
  });
});
