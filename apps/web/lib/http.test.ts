import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { handle, HttpError } from "./http";
import { ZodError } from "zod";

vi.mock("@sentry/nextjs");

const mockCaptureException = vi.mocked(Sentry.captureException);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handle()", () => {
  it("captures unexpected Error and returns 500", async () => {
    const error = new Error("Something broke");
    const result = await handle(() => {
      throw error;
    });

    expect(result.status).toBe(500);
    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("does not capture ZodError and returns 400", async () => {
    const zodError = new ZodError([]);
    const result = await handle(() => {
      throw zodError;
    });

    expect(result.status).toBe(400);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("does not capture HttpError and returns mapped status", async () => {
    const httpError404 = new HttpError(404, "not_found", "Not found");
    const result404 = await handle(() => {
      throw httpError404;
    });

    expect(result404.status).toBe(404);
    expect(mockCaptureException).not.toHaveBeenCalled();

    vi.clearAllMocks();

    const httpError409 = new HttpError(409, "conflict", "Conflict");
    const result409 = await handle(() => {
      throw httpError409;
    });

    expect(result409.status).toBe(409);
    expect(mockCaptureException).not.toHaveBeenCalled();

    vi.clearAllMocks();

    const httpError402 = new HttpError(402, "payment_required", "Payment required");
    const result402 = await handle(() => {
      throw httpError402;
    });

    expect(result402.status).toBe(402);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("does not capture on successful response", async () => {
    const result = await handle(() => Promise.resolve(new Response("OK")));

    expect(result.status).toBe(200);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
