import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError, ok } from "./http";

vi.mock("./observability/sentry", () => ({
  reportUnexpectedError: vi.fn(),
}));

const { reportUnexpectedError } = await import("./observability/sentry");

describe("handle()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls reportUnexpectedError on unexpected errors", async () => {
    const error = new Error("Something broke");
    const response = await handle(async () => {
      throw error;
    });

    expect(vi.mocked(reportUnexpectedError)).toHaveBeenCalledOnce();
    expect(vi.mocked(reportUnexpectedError)).toHaveBeenCalledWith(error);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });

  it("does not call reportUnexpectedError on ZodError", async () => {
    const schema = z.object({ name: z.string() });
    const response = await handle(async () => {
      schema.parse({});
    });

    expect(vi.mocked(reportUnexpectedError)).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("does not call reportUnexpectedError on HttpError", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(vi.mocked(reportUnexpectedError)).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("does not call reportUnexpectedError on successful response", async () => {
    const response = await handle(async () => {
      return ok({ id: "123" });
    });

    expect(vi.mocked(reportUnexpectedError)).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("123");
  });

  it("does not call reportUnexpectedError on HttpError with conflict status", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Class is full");
    });

    expect(vi.mocked(reportUnexpectedError)).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("conflict");
  });
});
