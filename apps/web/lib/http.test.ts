import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZodError } from "zod";
import { handle, HttpError, ok, badRequest, notFound, conflict } from "./http";

// Mock @sentry/nextjs
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { captureException } from "@sentry/nextjs";

describe("handle() error handling and Sentry reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unexpected errors", () => {
    it("reports unexpected error to Sentry and returns 500", async () => {
      const testError = new Error("Database connection failed");

      const response = await handle(async () => {
        throw testError;
      });

      expect(captureException).toHaveBeenCalledOnce();
      expect(captureException).toHaveBeenCalledWith(testError);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.code).toBe("internal_error");
      expect(body.error.message).toBe("Something went wrong");
    });

    it("reports TypeError to Sentry", async () => {
      const testError = new TypeError("Cannot read property 'x' of undefined");

      const response = await handle(async () => {
        throw testError;
      });

      expect(captureException).toHaveBeenCalledOnce();
      expect(captureException).toHaveBeenCalledWith(testError);
      expect(response.status).toBe(500);
    });
  });

  describe("validation errors (ZodError)", () => {
    it("does NOT report ZodError to Sentry", async () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["name"],
          message: "Expected string, received number",
        },
      ]);

      const response = await handle(async () => {
        throw zodError;
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("bad_request");
      expect(body.error.message).toBe("Validation failed");
    });
  });

  describe("deliberate HttpError", () => {
    it("does NOT report 404 HttpError to Sentry", async () => {
      const response = await handle(async () => {
        throw new HttpError(404, "not_found", "Member not found");
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe("not_found");
    });

    it("does NOT report 409 HttpError to Sentry", async () => {
      const response = await handle(async () => {
        throw new HttpError(409, "conflict", "Class is full");
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("conflict");
    });

    it("does NOT report 402 HttpError to Sentry", async () => {
      const response = await handle(async () => {
        throw new HttpError(402, "payment_required", "Payment pack is empty");
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(402);
      const body = await response.json();
      expect(body.error.code).toBe("payment_required");
    });

    it("does NOT report 400 HttpError to Sentry", async () => {
      const response = await handle(async () => {
        throw new HttpError(400, "bad_request", "Invalid input");
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("bad_request");
    });
  });

  describe("successful responses", () => {
    it("does NOT report to Sentry on successful response", async () => {
      const response = await handle(async () => {
        return ok({ id: "123", name: "Test" });
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ id: "123", name: "Test" });
    });

    it("does NOT report to Sentry on created response", async () => {
      const response = await handle(async () => {
        return ok({ id: "new" }, 201);
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(201);
    });
  });

  describe("helper functions use handle correctly", () => {
    it("badRequest helper with handle does NOT report to Sentry", async () => {
      const response = await handle(async () => badRequest("Invalid name"));

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("bad_request");
    });

    it("notFound helper with handle does NOT report to Sentry", async () => {
      const response = await handle(async () => notFound("User not found"));

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe("not_found");
    });

    it("conflict helper with handle does NOT report to Sentry", async () => {
      const response = await handle(async () => conflict("Resource already exists"));

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("conflict");
    });
  });

  describe("error details are preserved", () => {
    it("HttpError with details preserves all fields", async () => {
      const details = { field: "email", reason: "already_registered" };
      const response = await handle(async () => {
        throw new HttpError(400, "validation_failed", "Invalid email", details);
      });

      expect(captureException).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.details).toEqual(details);
    });
  });
});
