import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/reminders/run/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// requireSession() reads a Next.js cookie store, which isn't available outside
// a request context in these unit tests — mock it to resolve like a signed-in
// operator. A missing/invalid session is expected to surface the shared 401
// envelope via handle(), same as every other write endpoint.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));

describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 200 and queues pending reminder rows for a signed-in session", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued: number; skipped: number };
    expect(typeof body.queued).toBe("number");
    expect(typeof body.skipped).toBe("number");
  });
});
