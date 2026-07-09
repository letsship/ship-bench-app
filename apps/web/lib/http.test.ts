import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
import { HttpError, handle, ok } from "./http";

const { reportUnexpectedError } = vi.hoisted(() => ({ reportUnexpectedError: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ reportUnexpectedError }));

beforeEach(() => reportUnexpectedError.mockReset());

describe("handle", () => {
  it("returns the handler's response and reports nothing on success", async () => {
    const response = await handle(async () => ok({ hello: "world" }));

    expect(response.status).toBe(200);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("turns a ZodError into a 400 without reporting it", async () => {
    let zodError: ZodError;
    try {
      z.object({ name: z.string() }).parse({});
      throw new Error("unreachable");
    } catch (error) {
      zodError = error as ZodError;
    }

    const response = await handle(async () => {
      throw zodError;
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("turns an HttpError into its matching status without reporting it", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Class is full");
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("conflict");
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("turns an unexpected Error into a 500 and reports it exactly once", async () => {
    const error = new Error("database exploded");

    const response = await handle(async () => {
      throw error;
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    expect(reportUnexpectedError).toHaveBeenCalledExactlyOnceWith(error);
  });
});
