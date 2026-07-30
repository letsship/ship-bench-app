import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { HttpError, handle } from "./http";

const mockCaptureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

afterEach(() => {
  mockCaptureException.mockReset();
});

describe("handle", () => {
  describe("successful request", () => {
    it("returns the response and does not report to Sentry", async () => {
      const res = await handle(() =>
        Promise.resolve(new Response("ok", { status: 200 })),
      );
      expect(res.status).toBe(200);
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });

  describe("Zod validation error", () => {
    it("returns 400 and does not report to Sentry", async () => {
      const zodError = new ZodError([
        { code: "invalid_type", expected: "string", received: "undefined", path: ["name"], message: "Required" },
      ]);
      const res = await handle(() => Promise.reject(zodError));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("bad_request");
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });

  describe("HttpError", () => {
    it.each([
      [404, "not_found"],
      [409, "conflict"],
      [402, "payment_required"],
      [401, "unauthorized"],
    ])("returns %i and does not report to Sentry", async (status, code) => {
      const httpError = new HttpError(status, code, "something");
      const res = await handle(() => Promise.reject(httpError));
      expect(res.status).toBe(status);
      const body = await res.json();
      expect(body.error.code).toBe(code);
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });

  describe("unexpected error", () => {
    it("reports to Sentry and returns 500", async () => {
      const error = new Error("database connection failed");
      const res = await handle(() => Promise.reject(error));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe("internal_error");
      expect(mockCaptureException).toHaveBeenCalledTimes(1);
      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });
  });
});