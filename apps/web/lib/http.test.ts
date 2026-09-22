import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { createBookingSchema } from "@/lib/validation";
import { handle, HttpError, ok } from "@/lib/http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("handle", () => {
  const captureException = vi.mocked(Sentry.captureException);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports unexpected errors and returns the internal error envelope", async () => {
    const error = new Error("boom");

    const response = await handle(async () => {
      throw error;
    });

    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledWith(error);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });

  it("does not report validation errors", async () => {
    const response = await handle(async () => createBookingSchema.parse({}));

    expect(response.status).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [402, "payment_required"],
  ])("does not report expected HttpError responses (%i)", async (status, code) => {
    const response = await handle(async () => {
      throw new HttpError(status, code, "Expected error");
    });

    expect(response.status).toBe(status);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report successful responses", async () => {
    const response = await handle(async () => ok({}));

    expect(response.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });
});
