import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/local-db";
import type { Db } from "@/lib/db/types";
import { type Scenario, setupScenario } from "@/lib/test-support";
import {
  createClassType,
  createSession,
  getSessionView,
  listClassTypes,
  listSessions,
} from "./classes";

describe("classes service", () => {
  let db: Db;
  let scenario: Scenario;
  beforeEach(async () => {
    db = createTestDb();
    scenario = await setupScenario(db, { capacity: 10 });
  });

  it("lists sessions with occupancy and class metadata", async () => {
    const sessions = await listSessions(db, scenario.studioId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].classTypeName).toBe("Vinyasa Flow");
    expect(sessions[0].occupancy.capacity).toBe(10);
    expect(sessions[0].occupancy.booked).toBe(0);
  });

  it("filters sessions by range", async () => {
    const past = await listSessions(db, scenario.studioId, {
      from: "2000-01-01T00:00:00Z",
      to: "2000-01-02T00:00:00Z",
    });
    expect(past).toHaveLength(0);
  });

  it("lists and creates class types", async () => {
    expect(await listClassTypes(db, scenario.studioId)).toHaveLength(1);
    const created = await createClassType(db, scenario.studioId, {
      name: "Barre",
      defaultCapacity: 12,
      defaultPriceCents: 2000,
    });
    expect(created.name).toBe("Barre");
    expect(await listClassTypes(db, scenario.studioId)).toHaveLength(2);
  });

  it("creates a session for a known class type", async () => {
    const view = await createSession(db, scenario.studioId, {
      classTypeId: scenario.classTypeId,
      instructor: "Sam",
      startsAt: "2026-09-01T09:00:00Z",
      endsAt: "2026-09-01T10:00:00Z",
      capacity: 8,
    });
    expect(view.instructor).toBe("Sam");
    expect(view.occupancy.capacity).toBe(8);
  });

  it("rejects a session for an unknown class type", async () => {
    await expect(
      createSession(db, scenario.studioId, {
        classTypeId: "ct_missing",
        instructor: "Sam",
        startsAt: "2026-09-01T09:00:00Z",
        endsAt: "2026-09-01T10:00:00Z",
        capacity: 8,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("404s an unknown session", async () => {
    await expect(getSessionView(db, "cs_missing")).rejects.toMatchObject({ status: 404 });
  });
});
