"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../_components/client";

export function CancelClassButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onCancel() {
    if (
      !confirm(
        "Are you sure you want to cancel this class? All booked and waitlisted members will be notified.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await sendJson(`/api/classes/${sessionId}`, "DELETE");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="sb-btn" onClick={onCancel} disabled={pending}>
        {pending ? "Cancelling…" : "Cancel class"}
      </button>
      {error ? <span className="text-xs text-[var(--color-danger)]">{error}</span> : null}
    </span>
  );
}
