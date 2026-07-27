import { StatusBadge } from "../../_components/ui";

export function LineItemDescription({
  description,
  refunded,
}: {
  description: string;
  refunded: boolean;
}) {
  return (
    <>
      <span>{description}</span>
      {refunded ? (
        <span className="ml-2">
          <StatusBadge status="refunded" />
        </span>
      ) : null}
    </>
  );
}
