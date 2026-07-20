import { captureException } from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handle, HttpError, ok } from "./http";
import { ZodError } from "zod";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("handle()", () => {
  beforeEach(() => {
    vi.mocked(captureException).mockClear();
  });

  it("calls captureException and returns 500 when an unexpected error is thrown", async () => {
    const error = new Error("Database connection failed");
    const response = await handle(() => {
      throw error;
    });

    expect(response.status).toBe(500);
    expect(vi.mocked(captureException)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(captureException)).toHaveBeenCalledWith(error);

    const body = (await response.json()) as unknown;
    expect(body).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });

  it("does not call captureException for ZodError validation errors (returns 400)", async () => {
    const zodError = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        path: ["email"],
        message: "Expected string, received number",
      },
    ]);

    const response = await handle(() => {
      throw zodError;
    });

    expect(response.status).toBe(400);
    expect(vi.mocked(captureException)).not.toHaveBeenCalled();

    const body = (await response.json()) as unknown;
    expect(body).toEqual({
      error: {
        code: "bad_request",
        message: "Validation failed",
        details: expect.any(Object),
      },
    });
  });

  it("does not call captureException for HttpError with 404 status", async () => {
    const httpError = new HttpError(404, "not_found", "Member not found");

    const response = await handle(() => {
      throw httpError;
    });

    expect(response.status).toBe(404);
    expect(vi.mocked(captureException)).not.toHaveBeenCalled();

    const body = (await response.json()) as unknown;
    expect(body).toEqual({
      error: { code: "not_found", message: "Member not found" },
    });
  });

  it("does not call captureException for HttpError with 409 status", async () => {
    const httpError = new HttpError(409, "conflict", "Class is full");

    const response = await handle(() => {
      throw httpError;
    });

    expect(response.status).toBe(409);
    expect(vi.mocked(captureException)).not.toHaveBeenCalled();

    const body = (await response.json()) as unknown;
    expect(body).toEqual({
      error: { code: "conflict", message: "Class is full" },
    });
  });

  it("does not call captureException for HttpError with 402 status", async () => {
    const httpError = new HttpError(402, "payment_required", "No valid payment method");

    const response = await handle(() => {
      throw httpError;
    });

    expect(response.status).toBe(402);
    expect(vi.mocked(captureException)).not.toHaveBeenCalled();

    const body = (await response.json()) as unknown;
    expect(body).toEqual({
      error: { code: "payment_required", message: "No valid payment method" },
    });
  });

  it("does not call captureException for a successful response", async () => {
    const response = await handle(() => ok({ data: "success" }));

    expect(response.status).toBe(200);
    expect(vi.mocked(captureException)).not.toHaveBeenCalled();

    const body = (await response.json()) as unknown;
    expect(body).toEqual({ data: "success" });
  });

  it("does not call captureException for HttpError with details", async () => {
    const details = { field: "email", reason: "already_exists" };
    const httpError = new HttpError(400, "bad_request", "Email already exists", details);

    const response = await handle(() => {
      throw httpError;
    });

    expect(response.status).toBe(400);
    expect(vi.mocked(captureException)).not.toHaveBeenCalled();

    const body = (await response.json()) as unknown;
    expect(body).toEqual({
      error: {
        code: "bad_request",
        message: "Email already exists",
        details,
      },
    });
  });
});
