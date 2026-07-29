import { captureException } from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
import { handle, HttpError, ok, type ApiErrorBody } from "./http";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const capture = vi.mocked(captureException);

const errorBody = async (res: Response): Promise<ApiErrorBody> =>
  (await res.json()) as ApiErrorBody;

describe("handle()", () => {
  beforeEach(() => {
    capture.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports an unexpected error to Sentry and returns the 500 envelope", async () => {
    const boom = new Error("database connection lost");
    const res = await handle(async () => {
      throw boom;
    });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(boom);
    expect(console.error).toHaveBeenCalledWith("Unhandled API error", boom);
    expect(res.status).toBe(500);
    expect((await errorBody(res)).error.code).toBe("internal_error");
  });

  it("does not report a Zod validation error and returns 400", async () => {
    const schema = z.object({ name: z.string() });
    let thrown: unknown;
    try {
      schema.parse({ name: 42 });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ZodError);
    const res = await handle(async () => {
      throw thrown;
    });
    expect(capture).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error.code).toBe("bad_request");
  });

  it.each([404, 409, 402])(
    "does not report a deliberate HttpError and returns its own status (%i)",
    async (status) => {
      const res = await handle(async () => {
        throw new HttpError(status, "expected_outcome", "handled");
      });
      expect(capture).not.toHaveBeenCalled();
      expect(res.status).toBe(status);
      expect((await errorBody(res)).error.code).toBe("expected_outcome");
    },
  );

  it("reports nothing for a successful request", async () => {
    const res = await handle(async () => ok({ fine: true }));
    expect(capture).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
