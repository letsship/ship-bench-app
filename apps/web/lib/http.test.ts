import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("handle", () => {
  const captureException = vi.mocked(Sentry.captureException);

  beforeEach(() => {
    captureException.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports unexpected errors and returns the existing 500 envelope", async () => {
    const error = new Error("database unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledWith(error);
    expect(consoleError).toHaveBeenCalledWith("Unhandled API error", error);
  });

  it("does not report validation errors", async () => {
    const response = await handle(async () => {
      z.object({ name: z.string() }).parse({});
      return ok({ status: "ok" });
    });

    expect(response.status).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [402, "empty_pack"],
  ])("does not report handled HttpError responses (%i)", async (status, code) => {
    const response = await handle(async () => {
      throw new HttpError(status, code, "Expected outcome");
    });

    expect(response.status).toBe(status);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report successful responses", async () => {
    const response = await handle(async () => ok({ status: "ok" }));

    expect(response.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });
});
