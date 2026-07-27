import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs");

const mockCaptureException = vi.mocked(Sentry.captureException);

describe("handle()", () => {
  beforeEach(() => {
    mockCaptureException.mockClear();
  });

  it("captures unexpected errors to Sentry and returns 500", async () => {
    const testError = new Error("Database connection failed");
    const res = await handle(async () => {
      throw testError;
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(testError);
  });

  it("does not capture ZodError validation failures (400)", async () => {
    const schema = z.object({ name: z.string() });
    const zodError = schema.safeParse({}).error!;

    const res = await handle(async () => {
      throw zodError;
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("bad_request");
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("does not capture HttpError outcomes (404/409/402)", async () => {
    const httpError404 = new HttpError(404, "not_found", "Member not found");
    const res = await handle(async () => {
      throw httpError404;
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "not_found", message: "Member not found" },
    });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("does not capture HttpError conflict (409)", async () => {
    const httpError409 = new HttpError(409, "conflict", "Class is full");
    const res = await handle(async () => {
      throw httpError409;
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "conflict", message: "Class is full" },
    });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("does not capture successful responses (200)", async () => {
    const res = await handle(async () => {
      return ok({ status: "ok" });
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
