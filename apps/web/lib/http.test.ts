import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { captureException } from "@sentry/nextjs";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const mockedCaptureException = vi.mocked(captureException);

describe("handle", () => {
  beforeEach(() => {
    mockedCaptureException.mockReset();
  });

  it("captures unexpected errors and returns the existing 500 envelope", async () => {
    const error = new Error("database unavailable");

    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(mockedCaptureException).toHaveBeenCalledOnce();
    expect(mockedCaptureException).toHaveBeenCalledWith(error);
  });

  it("does not capture validation errors", async () => {
    const response = await handle(async () => {
      z.string().parse(42);
      return ok({});
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("bad_request");
    expect(mockedCaptureException).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [402, "payment_required"],
  ])("does not capture an expected HttpError (%s)", async (status, code) => {
    const response = await handle(async () => {
      throw new HttpError(status, code, "Expected failure");
    });

    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(code);
    expect(mockedCaptureException).not.toHaveBeenCalled();
  });

  it("does not capture successful responses", async () => {
    const response = await handle(async () => ok({ ready: true }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true });
    expect(mockedCaptureException).not.toHaveBeenCalled();
  });
});
