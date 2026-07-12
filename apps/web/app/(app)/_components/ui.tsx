import type { ReactNode } from "react";
import { formatMoney } from "@/lib/domain/money";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 pb-6">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="sb-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

export function Money({ cents, currency }: { cents: number; currency: string }) {
  return <>{formatMoney(cents, currency)}</>;
}

const BADGE_CLASS: Record<string, string> = {
  booked: "sb-badge-sage",
  attended: "sb-badge-sage",
  scheduled: "sb-badge-sage",
  active: "sb-badge-sage",
  paid: "sb-badge-sage",
  waitlisted: "sb-badge-clay",
  open: "sb-badge-clay",
  no_show: "sb-badge-muted",
  cancelled: "sb-badge-muted",
  paused: "sb-badge-muted",
  inactive: "sb-badge-muted",
  draft: "sb-badge-muted",
  void: "sb-badge-muted",
  refunded: "sb-badge-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return <span className={`sb-badge ${BADGE_CLASS[status] ?? ""}`}>{label}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="sb-card p-10 text-center text-sm text-[var(--color-muted)]">{children}</div>
  );
}
