import { NextResponse } from "next/server";
import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureException, flush } = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
}));

vi.mock("@sentry/nextjs", () => ({ captureException, flush }));

const { handle, HttpError } = await import("./http");

describe("handle", () => {
  beforeEach(() => {
    captureException.mockClear();
    flush.mockClear();
  });

  it("reports an unexpected error to Sentry and returns 500", async () => {
    const error = new Error("boom");
    const res = await handle(() => {
      throw error;
    });

    expect(res.status).toBe(500);
    expect(captureException).toHaveBeenCalledExactlyOnceWith(error);
    expect(flush).toHaveBeenCalledOnce();
  });

  it.each([404, 409, 402])("does not report a HttpError (%i) to Sentry", async (status) => {
    const res = await handle(() => {
      throw new HttpError(status, "some_error", "expected failure");
    });

    expect(res.status).toBe(status);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report a ZodError (400) to Sentry", async () => {
    const schema = z.object({ name: z.string() });
    const res = await handle(() => {
      schema.parse({});
    });

    expect(res.status).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report anything on success", async () => {
    const res = await handle(async () => NextResponse.json({ ok: true }));

    expect(res.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });
});
