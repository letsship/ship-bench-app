import { handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/health — a public health check for the SDLC/deploy pipeline.
export async function GET(): Promise<Response> {
  return handle(async () => {
    return ok({ status: "ok" });
  });
}
