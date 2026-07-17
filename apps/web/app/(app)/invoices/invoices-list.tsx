import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { InvoiceListItem } from "@/lib/services/invoices";
import { EmptyState, Money, StatusBadge } from "../_components/ui";

export const INVOICES_EMPTY_STATE_MESSAGE =
  "No invoices yet — invoices appear here after your first billing cycle";

export function InvoicesList({
  invoices,
  timezone,
}: {
  invoices: InvoiceListItem[];
  timezone: string;
}) {
  if (invoices.length === 0) {
    return <EmptyState>{INVOICES_EMPTY_STATE_MESSAGE}</EmptyState>;
  }

  return (
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
                {formatDate(invoice.issuedAt, timezone)}
              </td>
              <td className="text-right font-medium">
                <Money cents={invoice.totalCents} currency={invoice.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
