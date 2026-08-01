import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  init: vi.fn(),
}));

describe("handle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports unexpected errors and returns the existing 500 response", async () => {
    const error = new Error("database unavailable");

    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("does not report validation errors", async () => {
    const response = await handle(async () => {
      z.object({ name: z.string() }).parse({ name: 123 });
      return ok({ success: true });
    });

    expect(response.status).toBe(400);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])("does not report an HttpError with status %i", async (status) => {
    const response = await handle(async () => {
      throw new HttpError(status, "expected_error", "Expected failure");
    });

    expect(response.status).toBe(status);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not report successful requests", async () => {
    const expectedResponse = ok({ success: true });

    const response = await handle(async () => expectedResponse);

    expect(response).toBe(expectedResponse);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
