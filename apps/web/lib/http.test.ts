import { ZodError, z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, handle, ok } from "@/lib/http";
import { captureUnexpectedError } from "@/lib/monitoring/sentry";

vi.mock("@/lib/monitoring/sentry", () => ({ captureUnexpectedError: vi.fn() }));

describe("handle", () => {
  beforeEach(() => {
    vi.mocked(captureUnexpectedError).mockClear();
  });

  it("reports an unexpected thrown error to Sentry and returns 500", async () => {
    const error = new Error("db connection lost");
    const res = await handle(async () => {
      throw error;
    });
    expect(res.status).toBe(500);
    expect(captureUnexpectedError).toHaveBeenCalledTimes(1);
    expect(captureUnexpectedError).toHaveBeenCalledWith(error);
  });

  it("returns an HttpError's status without reporting to Sentry", async () => {
    const res = await handle(async () => {
      throw new HttpError(404, "not_found", "Member not found");
    });
    expect(res.status).toBe(404);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns 409 for a conflict HttpError without reporting to Sentry", async () => {
    const res = await handle(async () => {
      throw new HttpError(409, "conflict", "Class is full");
    });
    expect(res.status).toBe(409);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns 402 for a payment-required HttpError without reporting to Sentry", async () => {
    const res = await handle(async () => {
      throw new HttpError(402, "payment_required", "Pack is empty");
    });
    expect(res.status).toBe(402);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });

  it("returns 400 for a ZodError without reporting to Sentry", async () => {
    const res = await handle(async () => {
      z.object({ name: z.string() }).parse({});
      return ok({});
    });
    expect(res.status).toBe(400);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });

  it("propagates a ZodError thrown directly without reporting to Sentry", async () => {
    const res = await handle(async () => {
      throw new ZodError([]);
    });
    expect(res.status).toBe(400);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });

  it("reports nothing on a successful request", async () => {
    const res = await handle(async () => ok({ hello: "world" }));
    expect(res.status).toBe(200);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });
});
