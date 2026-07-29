import { createElement, type ReactNode } from "react";

export function LineItemDescription({ description }: { description: string }): ReactNode {
  return createElement("span", null, description);
}
