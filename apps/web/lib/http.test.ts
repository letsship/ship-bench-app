import { NextResponse } from "next/server";
import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, handle } from "./http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";

describe("handle", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockReset();
  });

  it("reports an unexpected error to Sentry and returns 500", async () => {
    const error = new Error("boom");
    const response = await handle(() => {
      throw error;
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "internal_error", message: "Something went wrong" } });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("does not report a Zod validation error", async () => {
    const schema = z.object({ name: z.string() });
    const response = await handle(async () => {
      schema.parse({});
      return NextResponse.json({});
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not report a deliberate HttpError", async () => {
    const response = await handle(() => {
      throw new HttpError(409, "conflict", "Class is full");
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "conflict", message: "Class is full" } });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not report anything on success", async () => {
    const response = await handle(async () => NextResponse.json({ ok: true }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
