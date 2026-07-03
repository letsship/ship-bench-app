"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../../_components/client";

const ACTION_LABEL: Record<string, string> = {
  open: "Open invoice",
  paid: "Mark as paid",
  void: "Void",
  refunded: "Refund",
  draft: "Back to draft",
};

export function InvoiceStatusControls({
  invoiceId,
  allowed,
}: {
  invoiceId: string;
  allowed: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function transitionTo(status: string) {
    setError(null);
    startTransition(async () => {
      try {
        await sendJson(`/api/invoices/${invoiceId}`, "PATCH", { status });
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed");
      }
    });
  }

  if (allowed.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No further actions.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowed.map((status) => (
        <button
          key={status}
          type="button"
          className={status === "paid" ? "sb-btn sb-btn-primary" : "sb-btn"}
          onClick={() => transitionTo(status)}
          disabled={pending}
        >
          {ACTION_LABEL[status] ?? status}
        </button>
      ))}
      {error ? <span className="text-sm text-[var(--color-danger)]">{error}</span> : null}
    </div>
  );
}
