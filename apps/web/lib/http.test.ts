import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { handle, HttpError, ok } from "./http";

describe("handle", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reports unexpected errors and returns the internal error response", async () => {
    const error = new Error("Database unavailable");

    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("does not report validation errors", async () => {
    const response = await handle(async () => {
      z.object({ email: z.email() }).parse({});
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

  it("does not report successful responses", async () => {
    const response = await handle(async () => ok({ success: true }));

    expect(response.status).toBe(200);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
