import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  flush: vi.fn(),
}));

describe("handle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Sentry.flush).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports unexpected errors and returns the internal error envelope", async () => {
    const error = new Error("unexpected");

    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("does not report validation errors", async () => {
    const schema = z.object({ name: z.string() });
    const error = schema.safeParse({}).error;

    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(400);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])("does not report handled HTTP %i errors", async (status) => {
    const response = await handle(async () => {
      throw new HttpError(status, "expected", "Expected failure");
    });

    expect(response.status).toBe(status);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns successful responses unchanged without reporting", async () => {
    const success = ok({ memberId: "m1" });

    const response = await handle(async () => success);

    expect(response).toBe(success);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
