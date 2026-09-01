import { NextResponse } from "next/server";
import { resetFakeBackends } from "@/lib/db/repos";

// Test-only seam: re-seed the in-memory fake store so e2e specs start each test
// from a clean, known dataset. Active ONLY under USE_FAKE_BACKENDS — returns 404
// otherwise, so it can never be reached in a real (D1) deployment.
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  if (process.env.USE_FAKE_BACKENDS !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  resetFakeBackends();
  return NextResponse.json({ reset: true });
}
