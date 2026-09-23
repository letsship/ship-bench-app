import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/sentry", () => ({
  reportUnexpectedError: vi.fn(),
}));

import { handle, HttpError } from "./http";
import { reportUnexpectedError } from "./observability/sentry";

describe("handle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports unexpected errors and returns the internal-error envelope", async () => {
    const error = new Error("database unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(reportUnexpectedError).toHaveBeenCalledTimes(1);
    expect(reportUnexpectedError).toHaveBeenCalledWith(error);
    expect(consoleError).toHaveBeenCalledWith("Unhandled API error", error);
    consoleError.mockRestore();
  });

  it("returns validation errors without reporting them", async () => {
    const validationError = new z.ZodError([]);

    const response = await handle(async () => {
      throw validationError;
    });

    expect(response.status).toBe(400);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])("returns HttpError status %i without reporting it", async (status) => {
    const response = await handle(async () => {
      throw new HttpError(status, "expected_error", "Expected error");
    });

    expect(response.status).toBe(status);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns successful responses unchanged without reporting", async () => {
    const response = new Response("ok", { status: 200 });

    const result = await handle(async () => response);

    expect(result).toBe(response);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });
});
