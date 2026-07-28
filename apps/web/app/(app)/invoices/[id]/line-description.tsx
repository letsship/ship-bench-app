import { StatusBadge } from "../../_components/ui";

export function InvoiceLineDescription({
  description,
  refunded,
}: {
  description: string;
  refunded: boolean;
}) {
  return (
    <>
      {/* Descriptions are staff-entered free text: render as escaped text only. */}
      {description}
      {refunded ? (
        <span className="ml-2">
          <StatusBadge status="refunded" />
        </span>
      ) : null}
    </>
  );
}
