import { createMigratedDb } from "@/lib/db/local-db";
import { studios } from "@/lib/db/schema";
import { buildSeed } from "@/lib/db/seed-data";
import { seedDatabase } from "@/lib/db/seed-runner";

// Migrate the local database and, if it is empty, insert the demo dataset.
const path = process.env.STUDIOBOOK_DB_PATH ?? ".data/studiobook.db";
const { db } = createMigratedDb(path);

const existing = await db.select({ id: studios.id }).from(studios).limit(1);
if (existing.length > 0) {
  console.log(`Studiobook: ${path} already has data — skipping seed (use db:reset to reseed).`);
} else {
  await seedDatabase(db, buildSeed());
  console.log(`Studiobook: seeded demo data into ${path}`);
}
