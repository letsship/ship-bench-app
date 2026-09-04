import { describe, expect, it, vi, beforeEach } from "vitest";
import { ZodError } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const Sentry = await import("@sentry/nextjs");

describe("handle()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures unexpected errors to Sentry and returns 500", async () => {
    const error = new Error("Something broke");
    const response = await handle(async () => {
      throw error;
    });

    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledOnce();
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });

  it("does not capture ZodError to Sentry and returns 400", async () => {
    const zodError = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        path: ["email"],
        message: "Expected string, received number",
      },
    ]);
    const response = await handle(async () => {
      throw zodError;
    });

    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("does not capture HttpError to Sentry and returns the error status", async () => {
    const httpError = new HttpError(404, "not_found", "Member not found");
    const response = await handle(async () => {
      throw httpError;
    });

    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("does not capture on successful handler", async () => {
    const response = await handle(async () => ok({ success: true }));

    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("handles conflict errors without capturing", async () => {
    const httpError = new HttpError(409, "conflict", "Class is full");
    const response = await handle(async () => {
      throw httpError;
    });

    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
  });

  it("handles payment required errors without capturing", async () => {
    const httpError = new HttpError(402, "payment_required", "Pack is empty");
    const response = await handle(async () => {
      throw httpError;
    });

    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled();
    expect(response.status).toBe(402);
  });
});
