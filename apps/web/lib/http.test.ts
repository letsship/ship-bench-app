import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, handle, ok } from "./http";
import { reportUnexpectedError } from "./monitoring/sentry";

vi.mock("./monitoring/sentry", () => ({ reportUnexpectedError: vi.fn() }));

const reportUnexpectedErrorMock = vi.mocked(reportUnexpectedError);

describe("handle", () => {
  beforeEach(() => {
    reportUnexpectedErrorMock.mockClear();
  });

  it("reports unexpected errors to Sentry and returns 500", async () => {
    const error = new Error("boom");
    const response = await handle(() => {
      throw error;
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(reportUnexpectedErrorMock).toHaveBeenCalledTimes(1);
    expect(reportUnexpectedErrorMock).toHaveBeenCalledWith(error);
  });

  it("does not report a thrown HttpError and returns its mapped status", async () => {
    const response = await handle(() => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
    expect(reportUnexpectedErrorMock).not.toHaveBeenCalled();
  });

  it("does not report a thrown ZodError and returns 400", async () => {
    const schema = z.object({ name: z.string() });
    const response = await handle(() => {
      schema.parse({});
      return Promise.resolve(ok({}));
    });

    expect(response.status).toBe(400);
    expect(reportUnexpectedErrorMock).not.toHaveBeenCalled();
  });

  it("reports nothing on a successful request", async () => {
    const response = await handle(async () => ok({ hello: "world" }));

    expect(response.status).toBe(200);
    expect(reportUnexpectedErrorMock).not.toHaveBeenCalled();
  });
});
