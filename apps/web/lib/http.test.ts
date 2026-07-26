import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
import { captureException } from "@/lib/monitoring";
import { HttpError, handle, ok } from "@/lib/http";

vi.mock("@/lib/monitoring", () => ({ captureException: vi.fn() }));

describe("handle", () => {
  beforeEach(() => {
    vi.mocked(captureException).mockReset();
  });

  it("reports an unexpected thrown error to Sentry and returns 500", async () => {
    const error = new Error("boom");
    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("does not report a ZodError validation failure", async () => {
    let zodError: ZodError;
    try {
      z.object({ name: z.string() }).parse({});
      throw new Error("expected parse to throw");
    } catch (error) {
      zodError = error as ZodError;
    }

    const response = await handle(async () => {
      throw zodError;
    });

    expect(response.status).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report a deliberate HttpError (e.g. 404/409/402)", async () => {
    for (const status of [404, 409, 402]) {
      vi.mocked(captureException).mockClear();
      const response = await handle(async () => {
        throw new HttpError(status, "expected_error", "Expected failure");
      });

      expect(response.status).toBe(status);
      expect(captureException).not.toHaveBeenCalled();
    }
  });

  it("reports nothing for a successful request", async () => {
    const response = await handle(async () => ok({ hello: "world" }));

    expect(response.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });
});
