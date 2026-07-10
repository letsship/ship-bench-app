import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpError, handle } from "./http";

vi.mock("@/lib/sentry", () => ({
  captureUnexpectedError: vi.fn().mockResolvedValue(undefined),
}));

import { captureUnexpectedError } from "@/lib/sentry";

describe("handle", () => {
  beforeEach(() => {
    vi.mocked(captureUnexpectedError).mockClear();
  });

  it("reports an unexpected error to Sentry and returns 500", async () => {
    const res = await handle(async () => {
      throw new Error("boom");
    });
    expect(res.status).toBe(500);
    expect(captureUnexpectedError).toHaveBeenCalledTimes(1);
  });

  it("does not report a ZodError (400) to Sentry", async () => {
    const res = await handle(async () => {
      z.object({ name: z.string() }).parse({});
    });
    expect(res.status).toBe(400);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [402, "payment_required"],
  ])("does not report an HttpError (%d) to Sentry", async (status, code) => {
    const res = await handle(async () => {
      throw new HttpError(status, code, "expected failure");
    });
    expect(res.status).toBe(status);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });

  it("reports nothing on success", async () => {
    const res = await handle(async () => new Response(null, { status: 200 }));
    expect(res.status).toBe(200);
    expect(captureUnexpectedError).not.toHaveBeenCalled();
  });
});
