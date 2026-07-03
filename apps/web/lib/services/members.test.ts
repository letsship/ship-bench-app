import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/local-db";
import { members } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { type Scenario, setupScenario } from "@/lib/test-support";
import { createMember, getMember, listMembers, updateMember } from "./members";

describe("members service", () => {
  let db: Db;
  let scenario: Scenario;
  beforeEach(async () => {
    db = createTestDb();
    scenario = await setupScenario(db);
  });

  it("lists the studio's members", async () => {
    expect(await listMembers(db, scenario.studioId)).toHaveLength(3);
  });

  it("creates a member", async () => {
    const member = await createMember(db, scenario.studioId, {
      name: "Nadia",
      email: "nadia@example.com",
      status: "active",
    });
    expect(member.email).toBe("nadia@example.com");
    expect(member.id).toMatch(/^mem_/);
  });

  it("rejects a duplicate email", async () => {
    await expect(
      createMember(db, scenario.studioId, {
        name: "Duplicate",
        email: "alice@example.com",
        status: "active",
      }),
    ).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("updates a member", async () => {
    const updated = await updateMember(db, scenario.memberA, { status: "paused" });
    expect(updated.status).toBe("paused");
    const [row] = await db.select().from(members).where(eq(members.id, scenario.memberA));
    expect(row.status).toBe("paused");
  });

  it("404s an unknown member", async () => {
    await expect(getMember(db, "mem_missing")).rejects.toMatchObject({ status: 404 });
  });
});
