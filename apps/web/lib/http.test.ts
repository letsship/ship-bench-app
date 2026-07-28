import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { HttpError, handle, ok } from "./http";

// Mock @sentry/nextjs so tests don't need a real DSN or network.
const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handle() — Sentry integration", () => {
  it("reports UNEXPECTED errors to Sentry and returns 500", async () => {
    const unexpected = new Error("Database connection lost");

    const response = await handle(async () => {
      throw unexpected;
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(unexpected);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });

  it("does NOT report ZodError (400 validation error) to Sentry", async () => {
    const zodError = new ZodError([
      { code: "too_small", minimum: 1, type: "string", inclusive: true, exact: false, message: "Required", path: ["name"] },
    ]);

    const response = await handle(async () => {
      throw zodError;
    });

    expect(captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });

  it("does NOT report HttpError (404) to Sentry", async () => {
    const notFoundError = new HttpError(404, "not_found", "Member not found");

    const response = await handle(async () => {
      throw notFoundError;
    });

    expect(captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });

  it("does NOT report HttpError (409) to Sentry", async () => {
    const conflictError = new HttpError(409, "conflict", "Class is full");

    const response = await handle(async () => {
      throw conflictError;
    });

    expect(captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
  });

  it("does NOT report HttpError (402) to Sentry", async () => {
    const paymentError = new HttpError(402, "payment_required", "Empty pack");

    const response = await handle(async () => {
      throw paymentError;
    });

    expect(captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(402);
  });

  it("does NOT report HttpError (401) to Sentry", async () => {
    const authError = new HttpError(401, "unauthorized", "Sign in required");

    const response = await handle(async () => {
      throw authError;
    });

    expect(captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("does NOT report anything on a successful response", async () => {
    const data = { id: "m1", name: "Alice" };

    const response = await handle(async () => ok(data));

    expect(captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(data);
  });
});