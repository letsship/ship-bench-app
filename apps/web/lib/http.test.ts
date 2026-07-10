import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, handle, ok } from "./http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("handle", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockReset();
  });

  it("reports an unexpected error to Sentry and returns 500", async () => {
    const response = await handle(async () => {
      throw new Error("boom");
    });

    expect(response.status).toBe(500);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it("does not report a thrown HttpError and returns its mapped status", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(response.status).toBe(404);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not report a HttpError for a full class (409)", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Class is full");
    });

    expect(response.status).toBe(409);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not report a HttpError for an empty pack (402)", async () => {
    const response = await handle(async () => {
      throw new HttpError(402, "payment_required", "Pack is empty");
    });

    expect(response.status).toBe(402);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not report a ZodError validation failure and returns 400", async () => {
    const schema = z.object({ name: z.string() });
    const response = await handle(async () => {
      schema.parse({});
      return ok({});
    });

    expect(response.status).toBe(400);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("does not report anything on success", async () => {
    const response = await handle(async () => ok({ ok: true }));

    expect(response.status).toBe(200);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
