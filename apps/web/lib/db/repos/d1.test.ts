import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createD1Repositories } from "./d1";
import type { Repositories } from "./types";

const NOW = "2026-03-15T12:00:00.000Z";
const migrationUrl = new URL("../../../migrations/0001_init.sql", import.meta.url);

describe("D1 repositories", () => {
  let miniflare: Miniflare;
  let database: D1Database;
  let repos: Repositories;

  beforeEach(async () => {
    miniflare = new Miniflare({ d1Databases: { DB: "studiobook-test" } });
    database = await miniflare.getD1Database("DB");
    await database.exec(await readFile(migrationUrl, "utf8"));
    repos = createD1Repositories(database);

    await database
      .prepare("insert into studios (id, name, slug, timezone, created_at) values (?, ?, ?, ?, ?)")
      .bind("studio_1", "Riverbank Movement", "riverbank", "Europe/Paris", NOW)
      .run();
    await database
      .prepare(
        `insert into studio_settings (
          studio_id, currency, tax_rate_bps, cancellation_window_hours, waitlist_enabled,
          notify_booking_confirmations, notify_cancellations, notify_waitlist_promotions, notify_invoices
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind("studio_1", "EUR", 2100, 12, 1, 1, 1, 1, 1)
      .run();
  });

  afterEach(async () => {
    await miniflare.dispose();
  });

  it("reads rows and round-trips boolean fields", async () => {
    const member = {
      id: "member_1",
      studioId: "studio_1",
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    };
    await repos.members.insert(member);

    expect(await repos.studios.getFirst()).toMatchObject({ id: "studio_1", name: "Riverbank Movement" });
    expect(await repos.settings.getByStudioId("studio_1")).toMatchObject({ waitlistEnabled: true });
    expect(await repos.members.findByEmail("studio_1", member.email)).toEqual(member);

    const settings = await repos.settings.update("studio_1", { waitlistEnabled: false });
    expect(settings.waitlistEnabled).toBe(false);
    expect(await database.prepare("select waitlist_enabled from studio_settings").first()).toEqual({
      waitlist_enabled: 0,
    });
  });

  it("filters sessions and preserves booking and invoice behavior", async () => {
    await repos.members.insert({
      id: "member_1",
      studioId: "studio_1",
      name: "Amara Okafor",
      email: "amara@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW,
    });
    await repos.classTypes.insert({
      id: "type_1",
      studioId: "studio_1",
      name: "Pilates",
      description: null,
      color: "#6b7280",
      defaultCapacity: 12,
      defaultPriceCents: 1800,
      createdAt: NOW,
    });

    const sessions = [
      ["session_1", "2026-03-16T09:00:00.000Z"],
      ["session_2", "2026-03-17T09:00:00.000Z"],
      ["session_3", "2026-03-18T09:00:00.000Z"],
    ] as const;
    await Promise.all(
      sessions.map(([id, startsAt]) =>
        repos.classSessions.insert({
          id,
          studioId: "studio_1",
          classTypeId: "type_1",
          instructor: "Nina",
          startsAt,
          endsAt: startsAt.replace("09:00", "10:00"),
          capacity: 12,
          priceCents: 1800,
          status: "scheduled",
          createdAt: NOW,
        }),
      ),
    );

    expect(
      await repos.classSessions.listByStudio("studio_1", {
        from: "2026-03-17T09:00:00.000Z",
        to: "2026-03-18T09:00:00.000Z",
      }),
    ).toHaveLength(1);

    await repos.bookings.insert({
      id: "booking_1",
      sessionId: "session_1",
      memberId: "member_1",
      status: "booked",
      bookedAt: NOW,
      cancelledAt: null,
    });
    expect(await repos.bookings.listBySessionIds([])).toEqual([]);
    expect(await repos.bookings.listBySessionIds(["session_1", "session_2"])).toHaveLength(1);

    await repos.invoices.insert({
      id: "invoice_1",
      studioId: "studio_1",
      memberId: "member_1",
      number: "INV-001",
      status: "issued",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 1800,
      taxCents: 378,
      totalCents: 2178,
      issuedAt: NOW,
      dueAt: null,
      paidAt: null,
      createdAt: NOW,
    });
    await repos.invoiceLineItems.insertMany([
      {
        id: "line_1",
        invoiceId: "invoice_1",
        description: "Pilates class",
        quantity: 1,
        unitAmountCents: 1800,
        amountCents: 1800,
        refunded: false,
        bookingId: "booking_1",
      },
    ]);

    expect(await repos.invoices.countByStudio("studio_1")).toBe(1);
    expect(await repos.invoiceLineItems.listByInvoice("invoice_1")).toMatchObject([{ refunded: false }]);
    expect(await database.prepare("select refunded from invoice_line_items").first()).toEqual({ refunded: 0 });
  });
});
