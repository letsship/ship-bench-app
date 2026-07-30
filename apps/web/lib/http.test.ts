import { captureException } from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpError, handle, ok } from "./http";
import { reportError } from "./monitoring/sentry";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/monitoring/sentry", () => ({ reportError: vi.fn() }));

const schema = z.object({ email: z.string() });

beforeEach(() => {
  vi.mocked(reportError).mockClear();
  vi.mocked(captureException).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handle() error reporting", () => {
  it("reports an unexpected error and still returns the 500 envelope", async () => {
    const boom = new Error("database connection lost");
    const response = await handle(async () => {
      throw boom;
    });

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(boom);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });

  it("reports a non-Error throw as well", async () => {
    const response = await handle(async () => {
      throw "kaboom";
    });

    expect(reportError).toHaveBeenCalledWith("kaboom");
    expect(response.status).toBe(500);
  });

  it("does not report a validation error", async () => {
    const response = await handle(async () => {
      schema.parse({ email: 42 });
      return ok({ ok: true });
    });

    expect(response.status).toBe(400);
    expect(reportError).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found", "Member not found"],
    [409, "conflict", "Class is full"],
    [402, "payment_required", "Pack is empty"],
  ])("does not report a deliberate %i HttpError", async (status, code, message) => {
    const response = await handle(async () => {
      throw new HttpError(status, code, message);
    });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: { code, message } });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports nothing on a successful request", async () => {
    const response = await handle(async () => ok({ id: "b1" }));

    expect(response.status).toBe(200);
    expect(reportError).not.toHaveBeenCalled();
  });
});

describe("reportError seam", () => {
  it("delegates to the Sentry SDK's captureException", async () => {
    const actual =
      await vi.importActual<typeof import("./monitoring/sentry")>("./monitoring/sentry");
    const boom = new Error("unexpected");

    actual.reportError(boom);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(boom);
  });
});
