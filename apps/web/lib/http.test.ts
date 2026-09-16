import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const reportUnexpectedError = vi.hoisted(() => vi.fn());

vi.mock("./sentry", () => ({ reportUnexpectedError }));

import { handle, HttpError } from "./http";

describe("handle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportUnexpectedError.mockResolvedValue(undefined);
  });

  it("reports unexpected errors and returns the existing 500 response", async () => {
    const error = new Error("unexpected failure");
    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(reportUnexpectedError).toHaveBeenCalledOnce();
    expect(reportUnexpectedError).toHaveBeenCalledWith(error);
  });

  it("returns validation failures without reporting them", async () => {
    const response = await handle(async () => {
      z.object({ name: z.string() }).parse({});
      return new Response();
    });

    expect(response.status).toBe(400);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [402, "payment_required"],
  ])("returns HttpError status %i without reporting it", async (status, code) => {
    const response = await handle(async () => {
      throw new HttpError(status, code, "Expected failure");
    });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: { code, message: "Expected failure" },
    });
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns successful responses without reporting anything", async () => {
    const response = await handle(async () => new Response("ok"));

    expect(response.status).toBe(200);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });
});
