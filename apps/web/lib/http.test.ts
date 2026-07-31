import { describe, it, expect, beforeEach, vi } from "vitest";
import { ZodError } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { captureException } from "@sentry/nextjs";

const mockedCaptureException = vi.mocked(captureException);

describe("handle()", () => {
  beforeEach(() => {
    mockedCaptureException.mockClear();
  });

  it("reports unexpected errors to Sentry and returns 500", async () => {
    const testError = new Error("Unexpected database failure");
    const fn = async () => {
      throw testError;
    };

    const response = await handle(fn);

    expect(response.status).toBe(500);
    expect(mockedCaptureException).toHaveBeenCalledTimes(1);
    expect(mockedCaptureException).toHaveBeenCalledWith(testError);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error.code).toBe("internal_error");
  });

  it("does not report ZodError to Sentry and returns 400", async () => {
    const zodError = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        path: ["name"],
        message: "Expected string, received number",
      },
    ]);

    const fn = async () => {
      throw zodError;
    };

    const response = await handle(fn);

    expect(response.status).toBe(400);
    expect(mockedCaptureException).not.toHaveBeenCalled();

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error.code).toBe("bad_request");
  });

  it("does not report HttpError to Sentry and returns the declared status (404)", async () => {
    const httpError = new HttpError(404, "not_found", "Member not found");
    const fn = async () => {
      throw httpError;
    };

    const response = await handle(fn);

    expect(response.status).toBe(404);
    expect(mockedCaptureException).not.toHaveBeenCalled();

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error.code).toBe("not_found");
  });

  it("does not report HttpError to Sentry and returns the declared status (409)", async () => {
    const httpError = new HttpError(409, "conflict", "Class is full");
    const fn = async () => {
      throw httpError;
    };

    const response = await handle(fn);

    expect(response.status).toBe(409);
    expect(mockedCaptureException).not.toHaveBeenCalled();

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error.code).toBe("conflict");
  });

  it("does not report HttpError to Sentry and returns the declared status (402)", async () => {
    const httpError = new HttpError(402, "payment_required", "Insufficient balance");
    const fn = async () => {
      throw httpError;
    };

    const response = await handle(fn);

    expect(response.status).toBe(402);
    expect(mockedCaptureException).not.toHaveBeenCalled();

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error.code).toBe("payment_required");
  });

  it("returns a successful response without reporting to Sentry", async () => {
    const fn = async () => ok({ id: 1, name: "test" });

    const response = await handle(fn);

    expect(response.status).toBe(200);
    expect(mockedCaptureException).not.toHaveBeenCalled();

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ id: 1, name: "test" });
  });

  it("reports non-Error unexpected values to Sentry and returns 500", async () => {
    const fn = async () => {
      throw "string error";
    };

    const response = await handle(fn);

    expect(response.status).toBe(500);
    expect(mockedCaptureException).toHaveBeenCalledTimes(1);
    expect(mockedCaptureException).toHaveBeenCalledWith("string error");

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error.code).toBe("internal_error");
  });
});
