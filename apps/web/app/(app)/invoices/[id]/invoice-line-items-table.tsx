import type { InvoiceLineItem } from "@/lib/db/types";
import { Money, StatusBadge } from "../../_components/ui";

export function InvoiceLineItemsTable({
  lineItems,
  currency,
}: {
  lineItems: InvoiceLineItem[];
  currency: string;
}) {
  return (
    <div className="sb-card mt-6 overflow-x-auto">
      <table className="sb-table">
        <thead>
          <tr>
            <th>Description</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line) => (
            <tr key={line.id}>
              <td>
                {/* line.description is untrusted, staff-entered text — keep it in a JSX
                    text position so React escapes it; never render it via dangerouslySetInnerHTML. */}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
