import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { getInvoiceDetail, updateInvoiceStatus } from "@/lib/services/invoices";
import { updateInvoiceStatusSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/invoices/:id — invoice with member + line items.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { id } = await params;
    return ok(await getInvoiceDetail(repos, ctx.studio.id, id));
  });
}

// PATCH /api/invoices/:id — advance the invoice status (draft→open→paid→…).
export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = await params;
    const { status } = updateInvoiceStatusSchema.parse(await request.json());
    return ok(await updateInvoiceStatus(repos, id, status));
  });
}
