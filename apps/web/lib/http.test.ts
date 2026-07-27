import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError } from "./http";

vi.mock("@/lib/observability/sentry");

describe("handle() reporting", () => {
  it("reports an unexpected error to Sentry and returns 500", async () => {
    const { reportUnexpectedError } = await import("@/lib/observability/sentry");
    const mockReport = vi.mocked(reportUnexpectedError);
    mockReport.mockClear();

    const testError = new Error("Something broke");
    const res = await handle(async () => {
      throw testError;
    });

    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(testError);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).code).toBe("internal_error");
  });

  it("does NOT report an HttpError", async () => {
    const { reportUnexpectedError } = await import("@/lib/observability/sentry");
    const mockReport = vi.mocked(reportUnexpectedError);
    mockReport.mockClear();

    const testError = new HttpError(404, "not_found", "Member not found");
    const res = await handle(async () => {
      throw testError;
    });

    expect(mockReport).not.toHaveBeenCalled();
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).code).toBe("not_found");
  });

  it("does NOT report a ZodError (validation failure)", async () => {
    const { reportUnexpectedError } = await import("@/lib/observability/sentry");
    const mockReport = vi.mocked(reportUnexpectedError);
    mockReport.mockClear();

    const schema = z.object({ name: z.string() });
    const res = await handle(async () => {
      schema.parse({ name: 123 });
      return NextResponse.json({});
    });

    expect(mockReport).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).code).toBe("bad_request");
  });

  it("does NOT report on a successful response", async () => {
    const { reportUnexpectedError } = await import("@/lib/observability/sentry");
    const mockReport = vi.mocked(reportUnexpectedError);
    mockReport.mockClear();

    const res = await handle(async () => {
      return NextResponse.json({ success: true });
    });

    expect(mockReport).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
  });
});
