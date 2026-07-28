/**
 * Renders an invoice line-item description as inert, escaped text.
 *
 * Line-item descriptions are free text entered by staff and must never be
 * interpreted as markup. React escapes text children, so returning the value
 * as a plain JSX child guarantees it renders verbatim — never as live HTML.
 */
export function LineItemDescription({ value }: { value: string }) {
  return <>{value}</>;
}
