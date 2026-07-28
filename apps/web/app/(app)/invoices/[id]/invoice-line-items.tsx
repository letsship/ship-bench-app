import type { ReactNode } from "react";
import { Money, StatusBadge } from "../../_components/ui";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  refunded: boolean;
}

export function InvoiceLineItems({
  lineItems,
  currency,
}: {
  lineItems: LineItem[];
  currency: string;
}): ReactNode {
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