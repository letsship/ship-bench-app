import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
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

export async function listInvoices(
  repos: Repositories,
  studioId: string,
): Promise<InvoiceListItem[]> {
  const invoices = await repos.invoices.listByStudio(studioId);
  const members = await repos.members.listByStudio(studioId);
  const nameById = new Map(members.map((member) => [member.id, member.name]));
  return invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    memberName: nameById.get(invoice.memberId) ?? "—",
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    totalCents: invoice.totalCents,
    currency: invoice.currency,
  }));
}

export async function getInvoiceDetail(repos: Repositories, id: string): Promise<InvoiceDetail> {
  const invoice = await repos.invoices.getById(id);
  if (!invoice) throw new HttpError(404, "not_found", "Invoice not found");
  const member = await repos.members.getById(invoice.memberId);
  if (!member) throw new HttpError(404, "not_found", "Invoice member not found");
  const lineItems = await repos.invoiceLineItems.listByInvoice(id);
  return { invoice, member, lineItems };
}

export async function createInvoice(
  repos: Repositories,
  provider: NotificationProvider,
  studioId: string,
  input: CreateInvoiceInput,
): Promise<InvoiceDetail> {
  const { settings } = await getStudioContext(repos);
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this invoice");
  }

  // Totals come from the single domain source of truth so refunded lines
  // are handled identically across every surface.
  const totals = computeInvoiceTotals(input.lineItems, settings.taxRateBps);
  const existingCount = await repos.invoices.countByStudio(studioId);
  const issuedAt = new Date().toISOString();
  const invoiceId = newId();

  const invoice = await repos.invoices.insert({
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
    paidAt: null,
    createdAt: issuedAt,
  });

  await repos.invoiceLineItems.insertMany(
    input.lineItems.map((line) => ({
      id: newId(),
      invoiceId,
      description: line.description,
      quantity: line.quantity,
      unitAmountCents: line.unitAmountCents,
      amountCents: line.quantity * line.unitAmountCents,
      refunded: false,
      bookingId: null,
    })),
  );

  await enqueueAndDispatch(
    repos,
    provider,
    invoiceIssued(
      { memberId: member.id, email: member.email, name: member.name },
      {
        number: invoice.number,
        totalCents: invoice.totalCents,
        currency: invoice.currency,
        dueAt: invoice.dueAt,
      },
    ),
  );
  return getInvoiceDetail(repos, invoiceId);
}

export async function updateInvoiceStatus(
  repos: Repositories,
  id: string,
  status: InvoiceStatus,
): Promise<Invoice> {
  const invoice = await repos.invoices.getById(id);
  if (!invoice) throw new HttpError(404, "not_found", "Invoice not found");
  if (!canTransitionInvoice(invoice.status as InvoiceStatus, status)) {
    throw new HttpError(
      409,
      "invalid_transition",
      `Cannot move invoice from ${invoice.status} to ${status}`,
    );
  }
  const paidAt = status === "paid" ? new Date().toISOString() : invoice.paidAt;
  return repos.invoices.update(id, { status, paidAt });
}
