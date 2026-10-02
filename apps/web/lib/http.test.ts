import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
}));

describe("handle", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Sentry.flush).mockResolvedValue(true);
  });

  afterEach(() => {
    consoleError.mockClear();
  });

  it("captures unexpected errors and returns the 500 envelope", async () => {
    const error = new Error("database unavailable");

    const response = await handle(async () => Promise.reject(error));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(Sentry.flush).toHaveBeenCalledWith(2000);
  });

  it("does not capture validation errors", async () => {
    const schema = z.object({ email: z.string().email() });
    const error = schema.safeParse({ email: "not-an-email" }).error;
    if (!error) {
      throw new Error("Expected schema validation to fail");
    }

    const response = await handle(async () => Promise.reject(error));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "bad_request", message: "Validation failed" },
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])("does not capture expected HttpError status %i", async (status) => {
    const response = await handle(async () => {
      throw new HttpError(status, "expected_error", "Expected failure");
    });

    expect(response.status).toBe(status);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not capture successful responses", async () => {
    const success = new Response(null, { status: 204 });

    const response = await handle(async () => success);

    expect(response).toBe(success);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
