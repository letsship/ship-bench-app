import { captureException } from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const mockedCapture = vi.mocked(captureException);

describe("handle()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports unexpected errors to Sentry and returns 500", async () => {
    const error = new Error("boom");
    const response = await handle(async () => {
      throw error;
    });
    expect(response.status).toBe(500);
    expect(mockedCapture).toHaveBeenCalledTimes(1);
    expect(mockedCapture).toHaveBeenCalledWith(error);
  });

  it("does not report Zod validation errors (400)", async () => {
    const response = await handle(async () => {
      z.object({ name: z.string() }).parse({});
      return ok({});
    });
    expect(response.status).toBe(400);
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it.each([404, 409, 402])(
    "does not report deliberate HttpErrors (%i)",
    async (status) => {
      const response = await handle(async () => {
        throw new HttpError(status, "expected", "handled outcome");
      });
      expect(response.status).toBe(status);
      expect(mockedCapture).not.toHaveBeenCalled();
    },
  );

  it("reports nothing on success", async () => {
    const response = await handle(async () => ok({ fine: true }));
    expect(response.status).toBe(200);
    expect(mockedCapture).not.toHaveBeenCalled();
  });
});
