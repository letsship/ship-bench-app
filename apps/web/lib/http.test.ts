import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpError, handle, ok } from "./http";
import { reportUnexpectedError } from "./observability/sentry";

vi.mock("./observability/sentry", () => ({ reportUnexpectedError: vi.fn() }));

describe("handle", () => {
  beforeEach(() => {
    vi.mocked(reportUnexpectedError).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports an unexpected error to Sentry and returns the existing 500", async () => {
    const boom = new Error("db exploded");
    const response = await handle(async () => {
      throw boom;
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(reportUnexpectedError).toHaveBeenCalledTimes(1);
    expect(reportUnexpectedError).toHaveBeenCalledWith(boom);
  });

  it("does not report a Zod validation error and returns 400", async () => {
    const response = await handle(async () => {
      z.object({ name: z.string() }).parse({ name: 42 });
      return ok({});
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [402, "payment_required"],
  ])("does not report a deliberate HttpError (%i %s)", async (status, code) => {
    const response = await handle(async () => {
      throw new HttpError(status, code, "handled outcome");
    });
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error.code).toBe(code);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("reports nothing on success and passes the response through", async () => {
    const response = await handle(async () => ok({ hello: "world" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hello: "world" });
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });
});
