import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  flush: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { HttpError, handle, ok } from "./http";

const captureException = vi.mocked(Sentry.captureException);
const flush = vi.mocked(Sentry.flush);

afterEach(() => {
  vi.clearAllMocks();
  flush.mockResolvedValue(true);
});

describe("handle", () => {
  it("returns successful responses without reporting them", async () => {
    const response = await handle(async () => ok({ member: "Ada" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ member: "Ada" });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("returns validation errors without reporting them", async () => {
    const response = await handle(async () => {
      z.object({ email: z.string().email() }).parse({ email: "invalid" });
      return ok({});
    });

    expect(response.status).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])("returns HttpError status %i without reporting it", async (status) => {
    const response = await handle(async () => {
      throw new HttpError(status, "expected_error", "Expected outcome");
    });

    expect(response.status).toBe(status);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("reports unexpected errors and returns the internal-error envelope", async () => {
    const error = new Error("database unavailable");
    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledWith(error);
    expect(flush).toHaveBeenCalledWith(2000);
  });
});
