import { ReactNode } from "react";

export function LineDescription({ description }: { description: string }): ReactNode {
  return <span>{description}</span>;
}
