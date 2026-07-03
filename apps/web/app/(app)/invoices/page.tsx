import Link from "next/link";
import { formatDate } from "@/lib/format";
import { resolveStudio } from "@/lib/services/context";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";
import { EmptyState, Money, PageHeader, StatusBadge } from "../_components/ui";
import { NewInvoiceForm } from "./new-invoice-form";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { db, ctx } = await resolveStudio();
  const [invoices, members] = await Promise.all([
    listInvoices(db, ctx.studio.id),
    listMembers(db, ctx.studio.id),
  ]);

  return (
    <>
      <PageHeader title="Invoices" subtitle={`${invoices.length} invoices`} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          {invoices.length === 0 ? (
            <EmptyState>No invoices yet.</EmptyState>
          ) : (
            <div className="sb-card overflow-x-auto">
              <table className="sb-table" data-testid="invoices-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Member</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="font-medium">
                        <Link href={`/invoices/${invoice.id}`} className="underline">
                          {invoice.number}
                        </Link>
                      </td>
                      <td>{invoice.memberName}</td>
                      <td>
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="whitespace-nowrap text-[var(--color-muted)]">
                        {formatDate(invoice.issuedAt, ctx.studio.timezone)}
                      </td>
                      <td className="text-right font-medium">
                        <Money cents={invoice.totalCents} currency={invoice.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <NewInvoiceForm members={members.map((member) => ({ id: member.id, name: member.name }))} />
      </div>
    </>
  );
}
