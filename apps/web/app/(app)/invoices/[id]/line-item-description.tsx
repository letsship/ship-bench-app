import { StatusBadge } from "../../_components/ui";

/**
 * Invoice line-item description cell. Descriptions are free text entered by
 * staff, so they must render as escaped text only — never as markup — or a
 * stored description containing HTML would execute in every viewer's browser.
 */
export function LineItemDescription({
  description,
  refunded,
}: {
  description: string;
  refunded: boolean;
}) {
  return (
    <>
      {description}
      {refunded ? (
        <span className="ml-2">
          <StatusBadge status="refunded" />
        </span>
      ) : null}
    </>
  );
}
