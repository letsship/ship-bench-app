import { resolveStudio } from "@/lib/services/context";
import { getRevenueReport } from "@/lib/services/reports";
import { EmptyState, Money, PageHeader, StatCard } from "../_components/ui";

export const dynamic = "force-dynamic";

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1));
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function ReportsPage() {
  const { repos, ctx } = await resolveStudio();
  const report = await getRevenueReport(repos, ctx);

  return (
    <>
      <PageHeader title="Reports" subtitle="Monthly revenue recognised from invoices." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Paid"
          value={<Money cents={report.totals.paidCents} currency={report.currency} />}
        />
        <StatCard
          label="Refunded"
          value={<Money cents={report.totals.refundedCents} currency={report.currency} />}
        />
        <StatCard
          label="Net"
          value={<Money cents={report.totals.netCents} currency={report.currency} />}
        />
      </div>

      <h2 className="mb-3 mt-10 text-xl">By month</h2>
      {report.rows.length === 0 ? (
        <EmptyState>No invoiced revenue yet.</EmptyState>
      ) : (
        <div className="sb-card overflow-x-auto">
          <table className="sb-table" data-testid="revenue-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Invoices</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Refunded</th>
                <th className="text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.month}>
                  <td className="font-medium">{monthLabel(row.month)}</td>
                  <td className="text-right">{row.invoiceCount}</td>
                  <td className="text-right">
                    <Money cents={row.paidCents} currency={report.currency} />
                  </td>
                  <td className="text-right">
                    <Money cents={row.refundedCents} currency={report.currency} />
                  </td>
                  <td className="text-right font-medium">
                    <Money cents={row.netCents} currency={report.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
