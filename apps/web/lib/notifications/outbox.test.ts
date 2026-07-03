import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/db/ids";
import { createTestDb } from "@/lib/db/local-db";
import { members, notificationOutbox, studioSettings, studios } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { testProvider } from "@/lib/test-support";
import { dispatchOutbox, enqueueNotification, shouldSend } from "./outbox";
import type { NotificationMessage, NotificationProvider } from "./types";

describe("shouldSend", () => {
  const base = {
    memberOptedOut: false,
    notifyBookingConfirmations: true,
    notifyCancellations: true,
    notifyWaitlistPromotions: true,
    notifyInvoices: true,
  };

  it("returns false when the member has opted out", () => {
    expect(shouldSend("booking_confirmation", { ...base, memberOptedOut: true })).toBe(false);
  });

  it("gates each kind on its studio setting", () => {
    expect(shouldSend("booking_confirmation", { ...base, notifyBookingConfirmations: false })).toBe(false);
    expect(shouldSend("invoice_issued", { ...base, notifyInvoices: false })).toBe(false);
    expect(shouldSend("waitlist_promotion", base)).toBe(true);
  });
});

interface OutboxFixture {
  memberId: string;
}

async function seedMember(
  db: Db,
  options: { optedOut?: boolean; settingOn?: boolean } = {},
): Promise<OutboxFixture> {
  const studioId = newId("stu");
  const memberId = newId("mem");
  await db.insert(studios).values({ id: studioId, name: "S", slug: "s", timezone: "UTC" });
  await db.insert(studioSettings).values({
    studioId,
    notifyBookingConfirmations: options.settingOn ?? true,
  });
  await db.insert(members).values({
    id: memberId,
    studioId,
    name: "Mia",
    email: "mia@example.com",
    status: "active",
    notificationsOptedOut: options.optedOut ?? false,
  });
  return { memberId };
}

function message(memberId: string): NotificationMessage {
  return {
    kind: "booking_confirmation",
    recipient: { memberId, email: "mia@example.com", name: "Mia" },
    subject: "Booked",
    body: "See you soon",
    data: {},
  };
}

describe("enqueueNotification", () => {
  let db: Db;
  beforeEach(() => {
    db = createTestDb();
  });

  it("writes a pending outbox row", async () => {
    const { memberId } = await seedMember(db);
    const id = await enqueueNotification(db, message(memberId));
    const [row] = await db.select().from(notificationOutbox).where(eq(notificationOutbox.id, id));
    expect(row.sentAt).toBeNull();
    expect(row.kind).toBe("booking_confirmation");
  });
});

describe("dispatchOutbox", () => {
  let db: Db;
  beforeEach(() => {
    db = createTestDb();
  });

  it("delivers pending rows and stamps sentAt + providerMessageId", async () => {
    const { memberId } = await seedMember(db);
    await enqueueNotification(db, message(memberId));
    const { provider, transport } = testProvider();

    const summary = await dispatchOutbox(db, provider);
    expect(summary).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(transport.sent).toHaveLength(1);
    const [row] = await db.select().from(notificationOutbox);
    expect(row.sentAt).not.toBeNull();
    expect(row.providerMessageId).toMatch(/^mj_/);
  });

  it("skips a member who opted out", async () => {
    const { memberId } = await seedMember(db, { optedOut: true });
    await enqueueNotification(db, message(memberId));
    const { provider, transport } = testProvider();

    const summary = await dispatchOutbox(db, provider);
    expect(summary).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(transport.sent).toHaveLength(0);
    const [row] = await db.select().from(notificationOutbox);
    expect(row.error).toBe("skipped:opted_out");
    expect(row.sentAt).not.toBeNull();
  });

  it("skips when the studio setting is off", async () => {
    const { memberId } = await seedMember(db, { settingOn: false });
    await enqueueNotification(db, message(memberId));
    const summary = await dispatchOutbox(db, testProvider().provider);
    expect(summary).toEqual({ sent: 0, skipped: 1, failed: 0 });
  });

  it("records a failure without stamping sentAt, so the row retries", async () => {
    const { memberId } = await seedMember(db);
    await enqueueNotification(db, message(memberId));
    const failing: NotificationProvider = {
      name: "failing",
      async send() {
        throw new Error("boom");
      },
    };

    const failed = await dispatchOutbox(db, failing);
    expect(failed).toEqual({ sent: 0, skipped: 0, failed: 1 });
    const [row] = await db.select().from(notificationOutbox);
    expect(row.sentAt).toBeNull();
    expect(row.error).toBe("boom");

    // A later run with a working provider delivers the retryable row.
    const retry = await dispatchOutbox(db, testProvider().provider);
    expect(retry).toEqual({ sent: 1, skipped: 0, failed: 0 });
  });
});
