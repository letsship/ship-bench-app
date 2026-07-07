type InvoiceLineDescriptionProps = {
  text: string;
};

// Renders a line-item description as a literal JSX text child. React escapes
// text children by default, so any markup in `text` is shown verbatim and never
// parsed into elements/handlers. Never use dangerouslySetInnerHTML here.
export function InvoiceLineDescription({ text }: InvoiceLineDescriptionProps) {
  return <span>{text}</span>;
}
