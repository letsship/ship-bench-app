import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  flush: vi.fn(),
}));

describe("handle", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockReset();
    vi.mocked(Sentry.flush).mockReset().mockResolvedValue(true);
    consoleError.mockClear();
  });

  it("reports unexpected errors and returns the internal error envelope", async () => {
    const error = new Error("database unavailable");
    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(Sentry.flush).toHaveBeenCalledWith(2000);
  });

  it("does not report validation errors", async () => {
    const response = await handle(async () => z.object({ name: z.string() }).parse({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "bad_request", message: "Validation failed" },
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "class_full"],
    [402, "empty_pack"],
  ])("does not report expected HttpError responses (%i)", async (status, code) => {
    const response = await handle(async () => {
      throw new HttpError(status, code, "Expected failure");
    });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns successful responses without reporting", async () => {
    const response = await handle(async () => ok({ memberId: "m1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ memberId: "m1" });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns the internal error response when Sentry reporting fails", async () => {
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
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to report API error to Sentry",
      expect.any(Error),
    );
  });
});
