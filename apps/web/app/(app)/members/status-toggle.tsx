"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../_components/client";

export function StatusToggle({ memberId, status }: { memberId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(status);

  function toggle() {
    const previous = current;
    const next = current === "active" ? "inactive" : "active";
    setCurrent(next);
    startTransition(async () => {
      try {
        await sendJson(`/api/members/${memberId}`, "PATCH", { status: next });
        router.refresh();
      } catch {
        setCurrent(previous);
      }
    });
  }

  return (
    <button type="button" className="sb-btn text-xs" onClick={toggle} disabled={pending}>
      {current === "active" ? "Deactivate" : "Reactivate"}
    </button>
  );
}
