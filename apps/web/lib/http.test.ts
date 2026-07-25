import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";

describe("handle() wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures unexpected errors and returns 500", async () => {
    const testError = new Error("Something broke");
    const response = await handle(() => {
      throw testError;
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("Something went wrong");
  });

  it("does not capture ZodError and returns 400", async () => {
    const schema = z.object({ name: z.string() });
    const response = await handle(() => {
      schema.parse({ name: 123 });
      return ok({});
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
  });

  it("does not capture HttpError 404 and returns 404", async () => {
    const response = await handle(() => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Member not found");
  });

  it("does not capture HttpError 409 and returns 409", async () => {
    const response = await handle(() => {
      throw new HttpError(409, "conflict", "Class is full");
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toBe("Class is full");
  });

  it("does not capture HttpError 402 and returns 402", async () => {
    const response = await handle(() => {
      throw new HttpError(402, "payment_required", "Insufficient credits");
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error.code).toBe("payment_required");
    expect(body.error.message).toBe("Insufficient credits");
  });

  it("does not capture on successful request", async () => {
    const response = await handle(() => Promise.resolve(ok({ id: "123" })));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("123");
  });

  it("does not capture on successful created response", async () => {
    const response = await handle(async () => {
      const data = await Promise.resolve({ id: "456" });
      // Using the handler pattern directly
      return ok(data, 201);
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toBe(201);
  });
});
