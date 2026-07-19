import React from "react";
import { type InvoiceLineItem } from "@/lib/db/types";
import { Money, StatusBadge } from "../../_components/ui";

interface InvoiceLineItemsProps {
  lineItems: InvoiceLineItem[];
  currency: string;
}

export function InvoiceLineItems({ lineItems, currency }: InvoiceLineItemsProps) {
  return (
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
        </tr>
      ))}
    </tbody>
  );
}
