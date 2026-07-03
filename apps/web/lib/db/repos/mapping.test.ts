import { describe, expect, it } from "vitest";
import { toCamelKey, toCamelRow, toSnakeKey, toSnakeRow } from "./mapping";

describe("key mapping", () => {
  it("camel → snake", () => {
    expect(toSnakeKey("studioId")).toBe("studio_id");
    expect(toSnakeKey("defaultCapacity")).toBe("default_capacity");
    expect(toSnakeKey("notificationsOptedOut")).toBe("notifications_opted_out");
    expect(toSnakeKey("id")).toBe("id");
  });

  it("snake → camel", () => {
    expect(toCamelKey("studio_id")).toBe("studioId");
    expect(toCamelKey("default_price_cents")).toBe("defaultPriceCents");
    expect(toCamelKey("provider_message_id")).toBe("providerMessageId");
    expect(toCamelKey("id")).toBe("id");
  });

  it("round-trips every entity field name", () => {
    for (const key of ["studioId", "taxRateBps", "cancellationWindowHours", "unitAmountCents"]) {
      expect(toCamelKey(toSnakeKey(key))).toBe(key);
    }
  });
});

describe("row mapping", () => {
  it("toSnakeRow maps keys and preserves values", () => {
    expect(toSnakeRow({ studioId: "s1", waitlistEnabled: true, taxRateBps: 900 })).toEqual({
      studio_id: "s1",
      waitlist_enabled: true,
      tax_rate_bps: 900,
    });
  });

  it("toCamelRow maps a snake_case DB row to a camelCase entity", () => {
    const row = {
      id: "cs_1",
      studio_id: "s1",
      class_type_id: "ct_1",
      starts_at: "2026-03-01T09:00:00.000Z",
      price_cents: 1800,
    };
    expect(toCamelRow(row)).toEqual({
      id: "cs_1",
      studioId: "s1",
      classTypeId: "ct_1",
      startsAt: "2026-03-01T09:00:00.000Z",
      priceCents: 1800,
    });
  });

  it("row mappers are inverses", () => {
    const entity = { memberId: "m1", providerMessageId: "re_x", sentAt: null };
    expect(toCamelRow(toSnakeRow(entity))).toEqual(entity);
  });
});
