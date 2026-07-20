import React from "react";

// Renders invoice line-item descriptions as escaped text. This component
// must never use dangerouslySetInnerHTML or any raw-HTML sink, as descriptions
// are free-text user input that can contain XSS payloads.
export function LineItemDescription({ description }: { description: string }) {
  return <span>{description}</span>;
}
