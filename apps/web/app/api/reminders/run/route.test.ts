import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { HttpError } from "@/lib/http";

vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn() }));

import { POST } from "./route";
import { requireSession } from "@/lib/auth/session";

const mockedRequireSession = vi.mocked(requireSession);

describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(new Date())));
    mockedRequireSession.mockResolvedValue({ email: "member@example.com" });
  });

  afterEach(() => {
    __setTestRepositories(null);
    vi.clearAllMocks();
  });

  it("returns 200 for an authenticated request", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("queued");
  });

  it("returns the shared 401 envelope when unauthenticated", async () => {
    mockedRequireSession.mockRejectedValue(new HttpError(401, "unauthorized", "Sign in required"));

    const response = await POST();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Sign in required" },
    });
  });
});
