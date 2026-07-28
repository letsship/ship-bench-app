"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../../_components/client";

export function RefundLineItemButton({
  invoiceId,
  lineItemId,
}: {
  invoiceId: string;
  lineItemId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refund() {
    setError(null);
    startTransition(async () => {
      try {
        await sendJson(`/api/invoices/${invoiceId}/line-items/${lineItemId}`, "PATCH", {
          refunded: true,
        });
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" className="sb-btn" onClick={refund} disabled={pending}>
        Refund
      </button>
      {error ? <span className="text-sm text-[var(--color-danger)]">{error}</span> : null}
    </span>
  );
}
