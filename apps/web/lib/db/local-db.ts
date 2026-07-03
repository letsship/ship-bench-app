import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import type { Db } from "./types";

// Node-only helpers for creating and migrating a local sqlite database. Used by
// the db scripts and by the test harness — never imported by app runtime code.

export const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export interface LocalDb {
  db: Db;
  sqlite: Database.Database;
}

// Open a sqlite database, apply all migrations, and return both the drizzle
// handle and the raw connection (the latter for introspection/dumping).
export function createMigratedDb(path: string): LocalDb {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db as never, { migrationsFolder: MIGRATIONS_DIR });
  return { db, sqlite };
}

// A fresh, migrated in-memory database for a single test.
export function createTestDb(): Db {
  return createMigratedDb(":memory:").db;
}
