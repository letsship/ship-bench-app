import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { handle, HttpError, ok } from "./http";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs");

type ErrorResponse = { error: { code: string } };

describe("handle()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("captures unexpected errors to Sentry and returns 500", async () => {
    const testError = new Error("Something went wrong");
    const res = await handle(async () => {
      throw testError;
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error.code).toBe("internal_error");
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(testError);
  });

  it("does not capture ZodError (validation) to Sentry and returns 400", async () => {
    const res = await handle(async () => {
      const schema = z.object({ name: z.string() });
      schema.parse({});
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error.code).toBe("bad_request");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not capture HttpError (404) to Sentry and returns appropriate status", async () => {
    const httpError = new HttpError(404, "not_found", "Member not found");
    const res = await handle(async () => {
      throw httpError;
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error.code).toBe("not_found");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not capture HttpError (409) to Sentry", async () => {
    const httpError = new HttpError(409, "conflict", "Class is full");
    const res = await handle(async () => {
      throw httpError;
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error.code).toBe("conflict");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not capture HttpError (402) to Sentry", async () => {
    const httpError = new HttpError(402, "payment_required", "Pack is empty");
    const res = await handle(async () => {
      throw httpError;
    });

    expect(res.status).toBe(402);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error.code).toBe("payment_required");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not capture successful responses to Sentry", async () => {
    const res = await handle(async () => {
      return ok({ id: 1, name: "Test" }, 200);
    });

    expect(res.status).toBe(200);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
