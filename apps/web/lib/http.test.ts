import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const { captureException } = await import("@sentry/nextjs");

describe("handle()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a plain error to Sentry and returns a 500", async () => {
    const thrownError = new Error("Something broke");
    const result = await handle(() => Promise.reject(thrownError));

    expect(vi.mocked(captureException)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(captureException)).toHaveBeenCalledWith(thrownError);
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error.code).toBe("internal_error");
  });

  it("does not report a ZodError to Sentry and returns a 400", async () => {
    const schema = z.object({ name: z.string() });

    const fn = async () => {
      schema.parse({});
    };

    const result = await handle(fn);

    expect(vi.mocked(captureException)).not.toHaveBeenCalled();
    expect(result.status).toBe(400);
    const body = await result.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("does not report a 404 HttpError to Sentry and returns a 404", async () => {
    const result = await handle(() => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(vi.mocked(captureException)).not.toHaveBeenCalled();
    expect(result.status).toBe(404);
    const body = await result.json();
    expect(body.error.code).toBe("not_found");
  });

  it("does not report a 409 HttpError to Sentry and returns a 409", async () => {
    const result = await handle(() => {
      throw new HttpError(409, "conflict", "Class is full");
    });

    expect(vi.mocked(captureException)).not.toHaveBeenCalled();
    expect(result.status).toBe(409);
    const body = await result.json();
    expect(body.error.code).toBe("conflict");
  });

  it("does not report a 402 HttpError to Sentry and returns a 402", async () => {
    const result = await handle(() => {
      throw new HttpError(402, "payment_required", "No active pack");
    });

    expect(vi.mocked(captureException)).not.toHaveBeenCalled();
    expect(result.status).toBe(402);
    const body = await result.json();
    expect(body.error.code).toBe("payment_required");
  });

  it("does not report a successful 200 response to Sentry", async () => {
    const result = await handle(() => Promise.resolve(ok({ success: true })));

    expect(vi.mocked(captureException)).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
  });
});
