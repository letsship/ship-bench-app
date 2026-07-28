import Link from "next/link";
import { notFound } from "next/navigation";
import { HttpError } from "@/lib/http";
import { type InvoiceStatus, canTransitionInvoice } from "@/lib/domain/invoices";
import { formatDate } from "@/lib/format";
import { resolveStudio } from "@/lib/services/context";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { Money, StatusBadge } from "../../_components/ui";
import { InvoiceLineItems } from "./invoice-line-items";
import { InvoiceStatusControls } from "./invoice-status-controls";

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
            <Money cents={invoice.totalCents} currency={currency} />
          </div>
        </div>
      </div>

      <InvoiceLineItems lineItems={lineItems} currency={currency} />

      <div className="mt-4 flex flex-col items-end gap-1 text-sm">
        <div>
          Subtotal <Money cents={invoice.subtotalCents} currency={currency} />
        </div>
        <div className="text-[var(--color-muted)]">
          Tax ({(invoice.taxRateBps / 100).toFixed(1)}%){" "}
          <Money cents={invoice.taxCents} currency={currency} />
        </div>
        <div className="text-lg font-semibold">
          Total <Money cents={invoice.totalCents} currency={currency} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-muted)]">Actions</h2>
        <InvoiceStatusControls invoiceId={invoice.id} allowed={allowed} />
      </div>
    </>
  );
}
