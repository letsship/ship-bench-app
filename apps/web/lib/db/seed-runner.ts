import {
  bookings,
  classSessions,
  classTypes,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  studioSettings,
  studios,
} from "./schema";
import type { SeedData } from "./seed-data";
import type { Db } from "./types";

// Insert a full SeedData set in foreign-key order. Assumes an empty, migrated
// database. Shared by scripts/seed.ts and (optionally) tests that want the demo
// dataset instead of hand-built fixtures.
export async function seedDatabase(db: Db, data: SeedData): Promise<void> {
  await db.insert(studios).values(data.studio);
  await db.insert(studioSettings).values(data.settings);
  await db.insert(members).values(data.members);
  await db.insert(classTypes).values(data.classTypes);
  await db.insert(classSessions).values(data.sessions);
  if (data.bookings.length > 0) await db.insert(bookings).values(data.bookings);
  await db.insert(invoices).values(data.invoices);
  await db.insert(invoiceLineItems).values(data.lineItems);
  await db.insert(notificationOutbox).values(data.outbox);
}
