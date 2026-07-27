import { captureException } from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpError, handle, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const zodError = () => {
  try {
    z.object({ email: z.string().email() }).parse({ email: "nope" });
  } catch (error) {
    return error;
  }
  throw new Error("expected a ZodError");
};

describe("handle()", () => {
  beforeEach(() => {
    vi.mocked(captureException).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports an unexpected error to Sentry and still returns the 500 envelope", async () => {
    const boom = new Error("database exploded");
    const res = await handle(() => {
      throw boom;
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(boom);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });

  it("reports a rejected promise from the handler", async () => {
    const boom = new Error("upstream timeout");
    const res = await handle(() => Promise.reject(boom));

    expect(captureException).toHaveBeenCalledWith(boom);
    expect(res.status).toBe(500);
  });

  it("does not report a Zod validation error and returns 400", async () => {
    const res = await handle(() => {
      throw zodError();
    });

    expect(captureException).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("bad_request");
  });

  it.each([
    [404, "not_found", "Member not found"],
    [409, "conflict", "Class is full"],
    [402, "payment_required", "Pack is empty"],
  ])("does not report an HttpError and returns %i", async (status, code, message) => {
    const res = await handle(() => {
      throw new HttpError(status, code, message);
    });

    expect(captureException).not.toHaveBeenCalled();
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: { code, message } });
  });

  it("reports nothing on a successful request", async () => {
    const res = await handle(async () => ok({ id: "m1" }));

    expect(captureException).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "m1" });
  });
});
