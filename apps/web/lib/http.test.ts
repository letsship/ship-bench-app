import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { reportUnexpectedError } from "@/lib/monitoring";
import { handle, HttpError, ok } from "./http";

vi.mock("@/lib/monitoring", () => ({ reportUnexpectedError: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handle", () => {
  it("reports an unexpected error to monitoring and responds 500", async () => {
    const boom = new Error("boom");
    const response = await handle(() => Promise.reject(boom));
    expect(response.status).toBe(500);
    expect(reportUnexpectedError).toHaveBeenCalledTimes(1);
    expect(reportUnexpectedError).toHaveBeenCalledWith(boom);
  });

  it("does not report a Zod validation error and responds 400", async () => {
    const response = await handle(async () => {
      z.object({ name: z.string() }).parse({});
      return ok({});
    });
    expect(response.status).toBe(400);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [402, "pack_empty"],
  ])("does not report an HttpError and responds %i", async (status, code) => {
    const response = await handle(() => {
      throw new HttpError(status, code, "expected outcome");
    });
    expect(response.status).toBe(status);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });

  it("reports nothing on a successful request", async () => {
    const response = await handle(async () => ok({ fine: true }));
    expect(response.status).toBe(200);
    expect(reportUnexpectedError).not.toHaveBeenCalled();
  });
});
