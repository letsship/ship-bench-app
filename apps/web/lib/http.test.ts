import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("./monitoring");

describe("handle()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports unexpected errors to Sentry and returns 500", async () => {
    const { reportException } = await import("./monitoring");
    const testError = new Error("Database connection failed");

    const response = await handle(async () => {
      throw testError;
    });

    expect(reportException).toHaveBeenCalledOnce();
    expect(reportException).toHaveBeenCalledWith(testError);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });

  it("does NOT report ZodError to Sentry; returns 400", async () => {
    const { reportException } = await import("./monitoring");
    const schema = z.object({ name: z.string() });

    const response = await handle(async () => {
      schema.parse({});
      return ok({});
    });

    expect(reportException).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
  });

  it("does NOT report HttpError (404) to Sentry; returns 404", async () => {
    const { reportException } = await import("./monitoring");

    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(reportException).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: "not_found", message: "Member not found" },
    });
  });

  it("does NOT report HttpError (409) to Sentry; returns 409", async () => {
    const { reportException } = await import("./monitoring");

    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Class is full");
    });

    expect(reportException).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: "conflict", message: "Class is full" },
    });
  });

  it("does NOT report HttpError (402) to Sentry; returns 402", async () => {
    const { reportException } = await import("./monitoring");

    const response = await handle(async () => {
      throw new HttpError(402, "payment_required", "Empty pack");
    });

    expect(reportException).not.toHaveBeenCalled();
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: "payment_required", message: "Empty pack" },
    });
  });

  it("does NOT report on successful response", async () => {
    const { reportException } = await import("./monitoring");

    const response = await handle(async () => {
      return ok({ id: 123, name: "Test" });
    });

    expect(reportException).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("includes details in HttpError response when provided", async () => {
    const { reportException } = await import("./monitoring");
    const details = { field: "email", reason: "already_exists" };

    const response = await handle(async () => {
      throw new HttpError(400, "validation_error", "Invalid input", details);
    });

    expect(reportException).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "validation_error",
        message: "Invalid input",
        details,
      },
    });
  });
});
