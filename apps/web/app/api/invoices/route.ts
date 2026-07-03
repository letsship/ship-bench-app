import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createInvoice, listInvoices } from "@/lib/services/invoices";
import { createNotificationProvider } from "@/lib/notifications/provider";
import { createInvoiceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/invoices — invoices with member name, newest first.
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { db, ctx } = await resolveStudio();
    return ok(await listInvoices(db, ctx.studio.id));
  });
}

// POST /api/invoices — issue an invoice from line items (totals + tax computed).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { db, ctx } = await resolveStudio();
    const input = createInvoiceSchema.parse(await request.json());
    return created(await createInvoice(db, createNotificationProvider(), ctx.studio.id, input));
  });
}
