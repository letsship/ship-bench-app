import { asc, eq } from "drizzle-orm";
import { newId } from "@/lib/db/ids";
import { members } from "@/lib/db/schema";
import type { Member } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validation";

export async function listMembers(db: Db, studioId: string): Promise<Member[]> {
  return db.select().from(members).where(eq(members.studioId, studioId)).orderBy(asc(members.name));
}

export async function getMember(db: Db, id: string): Promise<Member> {
  const [member] = await db.select().from(members).where(eq(members.id, id)).limit(1);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  return member;
}

export async function createMember(
  db: Db,
  studioId: string,
  input: CreateMemberInput,
): Promise<Member> {
  const existing = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, input.email))
    .limit(1);
  if (existing.length > 0) {
    throw new HttpError(409, "conflict", `A member with email ${input.email} already exists`);
  }
  const [member] = await db
    .insert(members)
    .values({
      id: newId("mem"),
      studioId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      status: input.status,
    })
    .returning();
  return member;
}

export async function updateMember(
  db: Db,
  id: string,
  input: UpdateMemberInput,
): Promise<Member> {
  await getMember(db, id);
  const [member] = await db.update(members).set(input).where(eq(members.id, id)).returning();
  return member;
}
