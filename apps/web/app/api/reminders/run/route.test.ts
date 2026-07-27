import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/reminders/run/route";
import { requireSession } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { HttpError } from "@/lib/http";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.mocked(requireSession).mockResolvedValue({ email: "owner@example.com" });
  });

  it("returns 200 and queues reminders for a signed-in session", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued: number; skipped: number };
    expect(typeof body.queued).toBe("number");
    expect(typeof body.skipped).toBe("number");
  });

  it("returns 401 when there is no signed-in session", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(
      new HttpError(401, "unauthorized", "Sign in required"),
    );
    const res = await POST();
    expect(res.status).toBe(401);
  });
});
