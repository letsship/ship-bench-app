import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/reminders/run/route";
import { HttpError } from "@/lib/http";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const requireSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireSession,
}));

describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    requireSession.mockResolvedValue({ email: "operator@example.com" });
    __setTestRepositories(createInMemoryRepositories(buildSeed(new Date("2026-03-15T12:00:00Z"))));
  });

  afterEach(() => {
    __setTestRepositories(null);
    vi.clearAllMocks();
  });

  it("returns a queue summary", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ queued: expect.any(Number), skipped: expect.any(Number) }));
  });

  it("requires a signed-in session", async () => {
    requireSession.mockRejectedValue(new HttpError(401, "unauthorized", "Sign in required"));
    const response = await POST();
    expect(response.status).toBe(401);
  });
});
