import { rmSync } from "node:fs";
import { createMigratedDb } from "@/lib/db/local-db";
import { buildSeed } from "@/lib/db/seed-data";
import { seedDatabase } from "@/lib/db/seed-runner";

// Delete the local database and rebuild it from scratch with fresh demo data.
// Used by the Playwright webServer so every e2e run starts from a known state.
const path = process.env.STUDIOBOOK_DB_PATH ?? ".data/studiobook.db";
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });

const { db } = createMigratedDb(path);
await seedDatabase(db, buildSeed());
console.log(`Studiobook: reset + seeded ${path}`);
