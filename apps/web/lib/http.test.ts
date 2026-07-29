import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { captureException } from "@sentry/nextjs";

const schema = z.object({ name: z.string() });

describe("handle()", () => {
  beforeEach(() => {
    vi.mocked(captureException).mockReset();
  });

  it("reports an unexpected throw to Sentry and returns 500", async () => {
    const boom = new Error("kaboom");
    const res = await handle(async () => {
      throw boom;
    });
    expect(res.status).toBe(500);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(boom);
  });

  it("does not report a ZodError (400 validation error)", async () => {
    const res = await handle(async () => {
      schema.parse({ name: 123 });
      return ok({});
    });
    expect(res.status).toBe(400);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report an HttpError (404 / 409 / 402)", async () => {
    for (const status of [404, 409, 402, 401]) {
      vi.mocked(captureException).mockReset();
      const res = await handle(async () => {
        throw new HttpError(status, "code", "msg");
      });
      expect(res.status).toBe(status);
      expect(captureException).not.toHaveBeenCalled();
    }
  });

  it("does not report a successful response", async () => {
    const res = await handle(async () => NextResponse.json({ ok: true }));
    expect(res.status).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });
});
