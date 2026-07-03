import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import type { Db } from "./types";

// Local sqlite driver for dev, `next start`, and tests. Never bundled into the
// Cloudflare Worker — lib/db/index.ts only reaches this branch off-Workers.

let cached: Db | null = null;

function resolveDbPath(): string {
  return process.env.STUDIOBOOK_DB_PATH ?? ".data/studiobook.db";
}

function ensureParentDir(path: string): void {
  if (path === ":memory:") return;
  const dir = dirname(path);
  if (dir && dir !== "." && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Build a drizzle instance over a better-sqlite3 connection. Callers that want
// an isolated database (tests) pass an explicit path such as ":memory:".
export function createNodeDb(path = resolveDbPath()): Db {
  ensureParentDir(path);
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema }) as unknown as Db;
}

// Process-wide singleton for dev / `next start`, so every request shares one
// connection to the seeded database file.
export function getNodeDb(): Db {
  if (!cached) cached = createNodeDb();
  return cached;
}
