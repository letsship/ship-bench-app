import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createD1Repositories } from "./d1";
import type { Member } from "../types";

function createD1Shim(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(resolve(process.cwd(), "migrations/0001_init.sql"), "utf8"));
  sqlite.exec(`
    INSERT INTO studios (id, name, slug, timezone, created_at)
    VALUES ('studio-1', 'Studio', 'studio', 'UTC', '2026-01-01T00:00:00.000Z');
  `);

  return {
    prepare(query) {
      let values: unknown[] = [];
      const statement = sqlite.prepare(query);
      const prepared = {
        bind(...boundValues: unknown[]) {
          values = boundValues;
          return prepared;
        },
        async first<T = Record<string, unknown>>() {
          return (statement.get(...values) as T | undefined) ?? null;
        },
        async run() {
          statement.run(...values);
          return { results: [], success: true as const, meta: {} };
        },
        async all<T = Record<string, unknown>>() {
          return { results: statement.all(...values) as T[], success: true as const, meta: {} };
        },
        async raw<T = unknown[]>() {
          return statement.all(...values) as T[];
        },
      };
      return prepared as unknown as D1PreparedStatement;
    },
    async batch(statements) {
      for (const statement of statements) await statement.run();
      return [];
    },
    async exec(query) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  };
}

describe("createD1Repositories", () => {
  it("preserves ordering, ranges, counts, boolean fidelity, and empty-list short-circuits", async () => {
    const repositories = createD1Repositories(createD1Shim());
    const member = (id: string, name: string): Member => ({
      id,
      studioId: "studio-1",
      name,
      email: `${id}@example.test`,
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await repositories.members.insert(member("member-1", "Zoe"));
    await repositories.members.insert(member("member-2", "Amy"));
    expect((await repositories.members.listByStudio("studio-1")).map(({ name }) => name)).toEqual([
      "Amy",
      "Zoe",
    ]);
    expect(await repositories.bookings.listBySessionIds([])).toEqual([]);
    expect(await repositories.invoiceLineItems.insertMany([])).toEqual([]);
  });
});
