"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../_components/client";

export interface MemberOption {
  id: string;
  name: string;
}

interface LineDraft {
  description: string;
  quantity: number;
  price: string; // major units, e.g. "18.00"
}

const EMPTY_LINE: LineDraft = { description: "", quantity: 1, price: "" };

export function NewInvoiceForm({ members }: { members: MemberOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const lineItems = lines
      .filter((line) => line.description.trim() !== "")
      .map((line) => ({
        description: line.description.trim(),
        quantity: line.quantity,
        unitAmountCents: Math.round(Number(line.price) * 100),
      }));
    if (lineItems.length === 0) {
      setError("Add at least one line item");
      return;
    }
    startTransition(async () => {
      try {
        await sendJson("/api/invoices", "POST", { memberId, lineItems });
        setLines([{ ...EMPTY_LINE }]);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not create invoice");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="sb-card space-y-4 p-5" aria-label="New invoice">
      <h2 className="text-lg">Issue an invoice</h2>
      <div>
        <label className="sb-label" htmlFor="invoice-member">
          Member
        </label>
        <select
          id="invoice-member"
          className="sb-select"
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[1fr_4rem_5rem] gap-2">
            <input
              className="sb-input"
              placeholder="Description"
              value={line.description}
              onChange={(event) => updateLine(index, { description: event.target.value })}
            />
            <input
              className="sb-input"
              type="number"
              min={1}
              aria-label="Quantity"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
            />
            <input
              className="sb-input"
              type="number"
              min={0}
              step="0.01"
              aria-label="Unit price"
              placeholder="0.00"
              value={line.price}
              onChange={(event) => updateLine(index, { price: event.target.value })}
            />
          </div>
        ))}
        <button
          type="button"
          className="sb-btn"
          onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}
        >
          + Add line
        </button>
      </div>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      <button type="submit" className="sb-btn sb-btn-primary w-full" disabled={pending}>
        {pending ? "Issuing…" : "Issue invoice"}
      </button>
    </form>
  );
}
