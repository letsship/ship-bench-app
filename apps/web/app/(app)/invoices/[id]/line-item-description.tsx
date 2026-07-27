import React from "react";
import { StatusBadge } from "../../_components/ui";

export function LineItemDescription({ value, refunded }: { value: string; refunded?: boolean }) {
  return (
    <>
      <span>{value}</span>
      {refunded ? (
        <span className="ml-2">
          <StatusBadge status="refunded" />
        </span>
      ) : null}
    </>
  );
}
