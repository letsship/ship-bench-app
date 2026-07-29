import { type InvoiceLineItem } from "@/lib/db/types";
import { Money, StatusBadge } from "../../_components/ui";

export function InvoiceLineItems({
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
                {/* Line descriptions are staff-entered free text; render as escaped
                    literal text so markup can never be injected into the page. */}
                <span>{line.description}</span>
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
