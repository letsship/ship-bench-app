import { count, desc, eq } from "drizzle-orm";
import { newId } from "@/lib/db/ids";
import { invoiceLineItems, invoices, members } from "@/lib/db/schema";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import {
  type InvoiceStatus,
  canTransitionInvoice,
  computeInvoiceTotals,
  formatInvoiceNumber,
} from "@/lib/domain/invoices";
import { HttpError } from "@/lib/http";
import { invoiceIssued } from "@/lib/notifications/messages";
import { enqueueAndDispatch } from "@/lib/notifications/outbox";
import type { NotificationProvider } from "@/lib/notifications/types";
import type { CreateInvoiceInput } from "@/lib/validation";
import { getStudioContext } from "./studio";

const DAY_MS = 86_400_000;

export interface InvoiceListItem {
  id: string;
  number: string;
  memberName: string;
  status: string;
  issuedAt: string;
  totalCents: number;
  currency: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  member: Member;
  lineItems: InvoiceLineItem[];
}

export async function listInvoices(db: Db, studioId: string): Promise<InvoiceListItem[]> {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      memberName: members.name,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      totalCents: invoices.totalCents,
      currency: invoices.currency,
    })
    .from(invoices)
    .innerJoin(members, eq(members.id, invoices.memberId))
    .where(eq(invoices.studioId, studioId))
    .orderBy(desc(invoices.issuedAt));
}

export async function getInvoiceDetail(db: Db, id: string): Promise<InvoiceDetail> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) throw new HttpError(404, "not_found", "Invoice not found");
  const [member] = await db.select().from(members).where(eq(members.id, invoice.memberId)).limit(1);
  if (!member) throw new HttpError(404, "not_found", "Invoice member not found");
  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id));
  return { invoice, member, lineItems };
}

export async function createInvoice(
  db: Db,
  provider: NotificationProvider,
  studioId: string,
  input: CreateInvoiceInput,
): Promise<InvoiceDetail> {
  const { settings } = await getStudioContext(db);
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, input.memberId))
    .limit(1);
  if (!member) throw new HttpError(400, "bad_request", "Unknown member for this invoice");

  const totals = computeInvoiceTotals(input.lineItems, settings.taxRateBps);
  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(invoices)
    .where(eq(invoices.studioId, studioId));
  const issuedAt = new Date().toISOString();
  const invoiceId = newId("inv");

  const [invoice] = await db
    .insert(invoices)
    .values({
      id: invoiceId,
      studioId,
      memberId: member.id,
      number: formatInvoiceNumber(existingCount + 1, new Date(issuedAt).getUTCFullYear()),
      status: "open",
      currency: settings.currency,
      taxRateBps: settings.taxRateBps,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      issuedAt,
      dueAt: input.dueAt ?? new Date(Date.now() + 14 * DAY_MS).toISOString(),
    })
    .returning();

  await db.insert(invoiceLineItems).values(
    input.lineItems.map((line) => ({
      id: newId("ili"),
      invoiceId,
      description: line.description,
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
      amountCents: line.quantity * line.unitAmountCents,
    })),
  );

  await enqueueAndDispatch(
    db,
    provider,
    invoiceIssued(
      { memberId: member.id, email: member.email, name: member.name },
      { number: invoice.number, totalCents: invoice.totalCents, currency: invoice.currency, dueAt: invoice.dueAt },
    ),
  );
  return getInvoiceDetail(db, invoiceId);
}

export async function updateInvoiceStatus(
  db: Db,
  id: string,
  status: InvoiceStatus,
): Promise<Invoice> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) throw new HttpError(404, "not_found", "Invoice not found");
  if (!canTransitionInvoice(invoice.status as InvoiceStatus, status)) {
    throw new HttpError(409, "invalid_transition", `Cannot move invoice from ${invoice.status} to ${status}`);
  }
  const paidAt = status === "paid" ? new Date().toISOString() : invoice.paidAt;
  const [updated] = await db
    .update(invoices)
    .set({ status, paidAt })
    .where(eq(invoices.id, id))
    .returning();
  return updated;
}
