import { captureException } from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const captureExceptionSpy = vi.mocked(captureException);

describe("handle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports unexpected errors to Sentry and returns a 500", async () => {
    const error = new Error("boom");
    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionSpy).toHaveBeenCalledWith(error);
  });

  it("does not report validation errors (400)", async () => {
    const schema = z.object({ name: z.string() });
    const response = await handle(async () => {
      schema.parse({});
      return ok({});
    });

    expect(response.status).toBe(400);
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])(
    "does not report HttpError (%i)",
    async (status) => {
      const response = await handle(async () => {
        throw new HttpError(status, "handled", "handled outcome");
      });

      expect(response.status).toBe(status);
      expect(captureExceptionSpy).not.toHaveBeenCalled();
    },
  );

  it("reports nothing on success", async () => {
    const response = await handle(async () => ok({ ok: true }));

    expect(response.status).toBe(200);
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });
});
