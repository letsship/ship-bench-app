import { Fragment, createElement } from "react";

export function LineItemDescription({ description }: { description: string }) {
  return createElement(Fragment, null, description);
}
