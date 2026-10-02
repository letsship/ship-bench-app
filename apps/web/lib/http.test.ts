import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  flush: vi.fn(),
}));

describe("handle", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockReset();
    vi.mocked(Sentry.flush).mockReset();
    vi.mocked(Sentry.flush).mockResolvedValue(true);
  });

  afterEach(() => {
    consoleError.mockClear();
  });

  it("reports unexpected errors and returns the internal error envelope", async () => {
    const error = new Error("boom");

    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(Sentry.flush).toHaveBeenCalledWith(2000);
  });

  it("does not report validation errors", async () => {
    const response = await handle(async () => z.object({ name: z.string() }).parse({}));

    expect(response.status).toBe(400);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])("does not report HttpError status %i", async (status) => {
    const response = await handle(async () => {
      throw new HttpError(status, "expected_error", "Expected error");
    });

    expect(response.status).toBe(status);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns successful responses without reporting them", async () => {
    const response = await handle(async () => ok({ success: true }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns a 500 when Sentry reporting fails", async () => {
    vi.mocked(Sentry.captureException).mockImplementation(() => {
      throw new Error("Sentry unavailable");
    });

    const response = await handle(async () => {
      throw new Error("boom");
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });
});
