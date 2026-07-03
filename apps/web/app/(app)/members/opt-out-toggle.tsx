"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../_components/client";

export function OptOutToggle({ memberId, optedOut }: { memberId: string; optedOut: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(!optedOut);

  function toggle() {
    const nextOptedOut = checked; // currently opted in → opting out
    setChecked(!checked);
    startTransition(async () => {
      try {
        await sendJson(`/api/members/${memberId}`, "PATCH", {
          notificationsOptedOut: nextOptedOut,
        });
        router.refresh();
      } catch {
        setChecked(checked); // revert on failure
      }
    });
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={toggle} disabled={pending} />
      {checked ? "On" : "Off"}
    </label>
  );
}
