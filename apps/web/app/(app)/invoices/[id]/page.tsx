import Link from "next/link";
import { notFound } from "next/navigation";
import { HttpError } from "@/lib/http";
import {
  type InvoiceStatus,
  canTransitionInvoice,
  computeInvoiceTotals,
} from "@/lib/domain/invoices";
import { formatDate } from "@/lib/format";
import { resolveStudio } from "@/lib/services/context";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { Money, StatusBadge } from "../../_components/ui";
import { InvoiceStatusControls } from "./invoice-status-controls";
import { LineItemRefundButton } from "./line-item-refund-button";

export const dynamic = "force-dynamic";

const ALL_STATUSES: InvoiceStatus[] = ["draft", "open", "paid", "void", "refunded"];

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { repos, ctx } = await resolveStudio();
  const { id } = await params;

  let detail: Awaited<ReturnType<typeof getInvoiceDetail>>;
  try {
    detail = await getInvoiceDetail(repos, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  const { invoice, member, lineItems } = detail;
  const currency = invoice.currency;
  // Derive the money box from the line items so a line-level refund shows up
  // immediately, not only after the stored totals are rewritten.
  const totals = computeInvoiceTotals(lineItems, invoice.taxRateBps);
  const allowed = ALL_STATUSES.filter((status) =>
    canTransitionInvoice(invoice.status as InvoiceStatus, status),
  );

  return (
    <>
      <Link href="/invoices" className="text-sm text-[var(--color-muted)] underline">
        ← All invoices
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{invoice.number}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {member.name} · {member.email}
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="sb-card p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Issued</div>
          <div className="mt-1">{formatDate(invoice.issuedAt, ctx.studio.timezone)}</div>
        </div>
        <div className="sb-card p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Due</div>
          <div className="mt-1">
            {invoice.dueAt ? formatDate(invoice.dueAt, ctx.studio.timezone) : "—"}
          </div>
        </div>
        <div className="sb-card p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Total</div>
          <div className="mt-1 text-xl font-semibold">
            <Money cents={totals.totalCents} currency={currency} />
          </div>
        </div>
      </div>

      <div className="sb-card mt-6 overflow-x-auto">
        <table className="sb-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.description}
                  {line.refunded ? (
                    <span className="ml-2">
                      <StatusBadge status="refunded" />
                    </span>
                  ) : null}
                </td>
                <td className="text-right">{line.quantity}</td>
                <td className="text-right">
                  <Money cents={line.unitAmountCents} currency={currency} />
                </td>
                <td className="text-right">
                  <Money cents={line.amountCents} currency={currency} />
                </td>
                <td className="text-right">
                  {line.refunded ? null : (
                    <LineItemRefundButton invoiceId={invoice.id} lineItemId={line.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-end gap-1 text-sm">
        <div>
          Subtotal <Money cents={totals.subtotalCents} currency={currency} />
        </div>
        <div className="text-[var(--color-muted)]">
          Tax ({(invoice.taxRateBps / 100).toFixed(1)}%){" "}
          <Money cents={totals.taxCents} currency={currency} />
        </div>
        <div className="text-lg font-semibold">
          Total <Money cents={totals.totalCents} currency={currency} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-muted)]">Actions</h2>
        <InvoiceStatusControls invoiceId={invoice.id} allowed={allowed} />
      </div>
    </>
  );
}
