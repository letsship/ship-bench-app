import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
import { HttpError, handle } from "./http";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("./observability/sentry", () => ({ captureException }));

describe("handle", () => {
  beforeEach(() => {
    captureException.mockReset();
  });

  it("reports and returns 500 for an unexpected error", async () => {
    const error = new Error("boom");
    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("returns 400 for a ZodError and does not report it", async () => {
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

  it.each([
    ["not found", 404, "not_found"],
    ["conflict", 409, "conflict"],
    ["payment required", 402, "payment_required"],
  ])("returns the HttpError status for %s and does not report it", async (_label, status, code) => {
    const response = await handle(async () => {
      throw new HttpError(status, code, "expected failure");
    });

    expect(response.status).toBe(status);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("reports nothing on success", async () => {
    const response = await handle(async () => new Response(null, { status: 200 }));

    expect(response.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });
});
