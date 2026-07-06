import { createElement } from "react";

export function LineItemDescription({ description }: { description: string }) {
  return createElement("span", null, description);
}
