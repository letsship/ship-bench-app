import { resolveStudio } from "@/lib/services/context";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";
import { PageHeader } from "../_components/ui";
import { InvoicesList } from "./invoices-list";
import { NewInvoiceForm } from "./new-invoice-form";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { repos, ctx } = await resolveStudio();
  const [invoices, members] = await Promise.all([
    listInvoices(repos, ctx.studio.id),
    listMembers(repos, ctx.studio.id),
  ]);

  return (
    <>
      <PageHeader title="Invoices" subtitle={`${invoices.length} invoices`} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <InvoicesList invoices={invoices} timezone={ctx.studio.timezone} />
        </div>
        <NewInvoiceForm members={members.map((member) => ({ id: member.id, name: member.name }))} />
      </div>
    </>
  );
}
