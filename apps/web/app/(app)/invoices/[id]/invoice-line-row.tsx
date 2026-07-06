import type { InvoiceLineItem } from "@/lib/db/types";
import { Money, StatusBadge } from "../../_components/ui";

export function InvoiceLineRow({ line, currency }: { line: InvoiceLineItem; currency: string }) {
  return (
    <tr>
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
  );
}
