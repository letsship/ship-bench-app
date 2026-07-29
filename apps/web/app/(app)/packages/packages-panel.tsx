"use client";

import { useEffect, useState, useTransition } from "react";
import { sendJson } from "../_components/client";
import type { Member } from "@/lib/db/types";

interface ClassPack {
  id: string;
  creditsRemaining: number;
  credits: number;
  priceCents: number;
  status: string;
}

export function PackagesPanel({ members }: { members: Member[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? "");
  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    if (!selectedMemberId) return;
    setLoadingBalance(true);
    (async () => {
      try {
        const packs = (await fetch(`/api/packages?memberId=${selectedMemberId}`).then((r) =>
          r.json(),
        )) as ClassPack[];
        const total = packs.reduce((sum, p) => sum + p.creditsRemaining, 0);
        setBalance(total);
      } catch {
        setBalance(0);
      } finally {
        setLoadingBalance(false);
      }
    })();
  }, [selectedMemberId]);

  function buyPack(credits: number) {
    if (!selectedMemberId) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await sendJson("/api/packages", "POST", { memberId: selectedMemberId, credits });
        setNotice(`${credits}-class pack purchased!`);
        const packs = (await fetch(`/api/packages?memberId=${selectedMemberId}`).then((r) =>
          r.json(),
        )) as ClassPack[];
        const total = packs.reduce((sum, p) => sum + p.creditsRemaining, 0);
        setBalance(total);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not purchase pack");
      }
    });
  }

  return (
    <div className="sb-card space-y-6 p-6">
      <div className="space-y-4">
        <div>
          <label className="sb-label" htmlFor="member-select">
            Member
          </label>
          <select
            id="member-select"
            className="sb-select"
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            disabled={pending || loadingBalance}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="sb-label">Credits Remaining</p>
          <p className="text-lg font-medium">
            {loadingBalance ? "Loading…" : `${balance} credits remaining`}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          className="sb-btn sb-btn-primary w-full"
          onClick={() => buyPack(10)}
          disabled={pending || loadingBalance || !selectedMemberId}
        >
          {pending ? "Purchasing…" : "Buy 10-class pack (€10.00)"}
        </button>
        <button
          className="sb-btn sb-btn-secondary w-full"
          onClick={() => buyPack(5)}
          disabled={pending || loadingBalance || !selectedMemberId}
        >
          {pending ? "Purchasing…" : "Buy 5-class pack (€5.00)"}
        </button>
      </div>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {notice ? <p className="text-sm text-[var(--color-sage)]">{notice}</p> : null}
    </div>
  );
}
