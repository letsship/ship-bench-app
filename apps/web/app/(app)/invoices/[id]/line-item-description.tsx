import * as React from "react";

export function LineItemDescription({ description }: { description: string }) {
  // Must never use dangerouslySetInnerHTML or any raw-HTML sink.
  return <>{description}</>;
}
