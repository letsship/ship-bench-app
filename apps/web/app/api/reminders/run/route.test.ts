import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireSession } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { HttpError } from "@/lib/http";
import { POST } from "./route";

// requireSession reads next/headers cookies, which has no request context in a
// unit test — mock the session seam (as providers.test.ts mocks `resend`).
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn() }));

describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(new Date())));
    vi.mocked(requireSession).mockResolvedValue({ email: "owner@studiobook.test" });
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.mocked(requireSession).mockReset();
  });

  it("returns 200 with the number of queued reminders", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    // The demo seed always has classes (with confirmed seats) inside 24 hours.
    const body = (await res.json()) as { queued: number };
    expect(body.queued).toBeGreaterThan(0);
  });

  it("is idempotent — a second run queues nothing new", async () => {
    const first = (await (await POST()).json()) as { queued: number };
    const second = (await (await POST()).json()) as { queued: number };
    expect(first.queued).toBeGreaterThan(0);
    expect(second.queued).toBe(0);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(requireSession).mockRejectedValue(
      new HttpError(401, "unauthorized", "Sign in required"),
    );
    const res = await POST();
    expect(res.status).toBe(401);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "unauthorized" },
    });
  });
});
