"use client";

import { useRouter } from "next/navigation";
import { type InvoiceStatus, INVOICE_STATUSES } from "@/lib/domain/invoices";

export function InvoiceStatusFilter({ value }: { value: InvoiceStatus | null }) {
  const router = useRouter();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    router.push(next === "all" ? "/invoices" : `/invoices?status=${next}`);
  }

  return (
    <div className="mb-4 max-w-xs">
      <label className="sb-label" htmlFor="invoice-status-filter">
        Status
      </label>
      <select
        id="invoice-status-filter"
        className="sb-select"
        value={value ?? "all"}
        onChange={onChange}
      >
        <option value="all">All</option>
        {INVOICE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  );
}
