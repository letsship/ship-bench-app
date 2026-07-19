import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import * as Sentry from "@sentry/nextjs";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs");

describe("handle()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports unexpected errors to Sentry and returns 500", async () => {
    const unexpectedError = new Error("Database connection failed");
    const handler = () => Promise.reject(unexpectedError);

    const response = await handle(handler);

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    expect(Sentry.captureException).toHaveBeenCalledWith(unexpectedError);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });

  it("does not report ZodError to Sentry, returns 400", async () => {
    const error = new ZodError(
      [
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["name"],
          message: "Expected string, received number",
        },
      ],
      "Validation failed",
    );
    const handler = () => Promise.reject(error);

    const response = await handle(handler);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("does not report HttpError (404) to Sentry, returns 404", async () => {
    const error = new HttpError(404, "not_found", "Member not found");
    const handler = () => Promise.reject(error);

    const response = await handle(handler);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("does not report HttpError (409) to Sentry, returns 409", async () => {
    const error = new HttpError(409, "conflict", "Class is full");
    const handler = () => Promise.reject(error);

    const response = await handle(handler);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("conflict");
  });

  it("does not report HttpError (402) to Sentry, returns 402", async () => {
    const error = new HttpError(402, "payment_required", "Empty pack");
    const handler = () => Promise.reject(error);

    const response = await handle(handler);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error.code).toBe("payment_required");
  });

  it("does not report Sentry for successful responses", async () => {
    const successResponse = ok({ id: 123 });
    const handler = () => Promise.resolve(successResponse);

    const response = await handle(handler);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("does not report Sentry for created responses", async () => {
    const createdResponse = NextResponse.json({ id: 456 }, { status: 201 });
    const handler = () => Promise.resolve(createdResponse);

    const response = await handle(handler);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(201);
  });
});
