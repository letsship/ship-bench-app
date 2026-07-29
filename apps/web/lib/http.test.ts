import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { handle, HttpError } from "./http";

const mockReportUnexpectedError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/observability/sentry", () => ({
  reportUnexpectedError: mockReportUnexpectedError,
}));

beforeEach(() => {
  mockReportUnexpectedError.mockReset();
});

describe("handle()", () => {
  it("returns 200 for a successful handler and reports nothing", async () => {
    const res = await handle(() => Promise.resolve(new Response("ok", { status: 200 })));
    expect(res.status).toBe(200);
    expect(mockReportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns 400 for a ZodError and does NOT report to Sentry", async () => {
    const zodError = new ZodError([{ code: "invalid_type", expected: "string", received: "number", path: ["name"], message: "Expected string, received number" }]);
    const res = await handle(() => Promise.reject(zodError));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("bad_request");
    expect(mockReportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns the HttpError status for an HttpError and does NOT report", async () => {
    const httpError = new HttpError(404, "not_found", "Member not found");
    const res = await handle(() => Promise.reject(httpError));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(mockReportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns 409 for an HttpError with status 409 and does NOT report", async () => {
    const httpError = new HttpError(409, "conflict", "Class is full");
    const res = await handle(() => Promise.reject(httpError));
    expect(res.status).toBe(409);
    expect(mockReportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns 402 for an HttpError with status 402 and does NOT report", async () => {
    const httpError = new HttpError(402, "payment_required", "No credits remaining");
    const res = await handle(() => Promise.reject(httpError));
    expect(res.status).toBe(402);
    expect(mockReportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns 401 for an HttpError with status 401 and does NOT report", async () => {
    const httpError = new HttpError(401, "unauthorized", "Sign in required");
    const res = await handle(() => Promise.reject(httpError));
    expect(res.status).toBe(401);
    expect(mockReportUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns 500 for an unexpected error AND reports to Sentry", async () => {
    const error = new Error("Database connection failed");
    const res = await handle(() => Promise.reject(error));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(mockReportUnexpectedError).toHaveBeenCalledTimes(1);
    expect(mockReportUnexpectedError).toHaveBeenCalledWith(error);
  });

  it("reports a thrown non-Error value to Sentry and returns 500", async () => {
    const res = await handle(() => Promise.reject("string error"));
    expect(res.status).toBe(500);
    expect(mockReportUnexpectedError).toHaveBeenCalledTimes(1);
    expect(mockReportUnexpectedError).toHaveBeenCalledWith("string error");
  });
});