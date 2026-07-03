import { createMigratedDb } from "@/lib/db/local-db";

// Apply all migrations to the local sqlite database (dev / `next start`).
const path = process.env.STUDIOBOOK_DB_PATH ?? ".data/studiobook.db";
createMigratedDb(path);
console.log(`Studiobook: migrated ${path}`);
