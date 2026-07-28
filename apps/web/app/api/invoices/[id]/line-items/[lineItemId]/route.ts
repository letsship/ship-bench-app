import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { refundInvoiceLineItem } from "@/lib/services/invoices";
import { refundLineItemSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; lineItemId: string }> };

// PATCH /api/invoices/:id/line-items/:lineItemId — refund a single line item.
export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id, lineItemId } = await params;
    refundLineItemSchema.parse(await request.json());
    return ok(await refundInvoiceLineItem(repos, id, lineItemId));
  });
}
