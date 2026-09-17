import { ZodError } from "zod";
import { describe, expect, it, vi } from "vitest";
import { handle, HttpError } from "./http";
import { reportUnexpectedError } from "./sentry";

vi.mock("./sentry", () => ({ reportUnexpectedError: vi.fn() }));

describe("handle", () => {
  it("returns a successful response without reporting an error", async () => {
    const response = await handle(async () => new Response("ok"));

    expect(response.status).toBe(200);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns validation errors without reporting them", async () => {
    const response = await handle(async () => {
      throw new ZodError([]);
    });

    expect(response.status).toBe(400);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns HttpErrors without reporting them", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "class_full", "This class is full");
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "class_full", message: "This class is full" },
    });
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("reports unexpected errors and returns the existing 500 response", async () => {
    const error = new Error("database unavailable");
    const response = await handle(async () => {
      throw error;
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(reportUnexpectedError).toHaveBeenCalledOnce();
    expect(reportUnexpectedError).toHaveBeenCalledWith(error);
  });
});
