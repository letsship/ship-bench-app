import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  flush: vi.fn(),
}));

describe("handle", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockReset();
    vi.mocked(Sentry.flush).mockReset();
    vi.mocked(Sentry.flush).mockResolvedValue(true);
  });

  it("reports unexpected errors and returns the internal error envelope", async () => {
    const error = new Error("database unavailable");

    const response = await handle(async () => {
      throw error;
    });

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(Sentry.flush).toHaveBeenCalledWith(2000);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });

  it("does not report validation errors", async () => {
    const response = await handle(async () => {
      z.object({ name: z.string() }).parse({});
      return new Response();
    });

    expect(response.status).toBe(400);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])("does not report handled HTTP %i errors", async (status) => {
    const response = await handle(async () => {
      throw new HttpError(status, "expected_error", "Expected failure");
    });

    expect(response.status).toBe(status);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns successful responses without reporting", async () => {
    const successfulResponse = new Response("Created", { status: 201 });

    const response = await handle(async () => successfulResponse);

    expect(response).toBe(successfulResponse);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns an internal error when Sentry reporting fails", async () => {
    vi.mocked(Sentry.captureException).mockImplementation(() => {
      throw new Error("Sentry unavailable");
    });

    const response = await handle(async () => {
      throw new Error("database unavailable");
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });
});
