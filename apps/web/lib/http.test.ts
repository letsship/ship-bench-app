import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

const { handle, HttpError, ok } = await import("@/lib/http");

describe("handle()", () => {
  afterEach(() => {
    captureException.mockClear();
  });

  it("reports an unexpected error to Sentry and returns 500", async () => {
    const error = new Error("boom");
    const res = await handle(async () => {
      throw error;
    });

    expect(res.status).toBe(500);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("does not report a ZodError validation failure to Sentry", async () => {
    const res = await handle(async () => {
      z.object({ name: z.string() }).parse({});
    });

    expect(res.status).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report an HttpError to Sentry", async () => {
    const res = await handle(async () => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(res.status).toBe(404);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report anything for a successful request", async () => {
    const res = await handle(async () => ok({ hello: "world" }));

    expect(res.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });
});
