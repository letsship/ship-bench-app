import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handle, HttpError } from "@/lib/http";

// Mock the observability seam so we can assert what gets reported to Sentry
// without depending on the real SDK, a DSN, or the network.
vi.mock("@/lib/observability/sentry", () => ({
  captureException: vi.fn(),
}));

const { captureException } = await import("@/lib/observability/sentry");
const capture = vi.mocked(captureException);

const schema = z.object({ name: z.string() });

describe("handle", () => {
  beforeEach(() => {
    capture.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports an unexpected error to Sentry and returns 500", async () => {
    const error = new Error("boom");
    const response = await handle(() => Promise.reject(error));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong" },
    });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error);
  });

  it("does not report a Zod validation error (400)", async () => {
    const fn = () => Promise.resolve(schema.parse({ name: 123 as unknown as string }));
    const response = await handle(fn);

    expect(response.status).toBe(400);
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    [404, "not_found", "Not found"],
    [409, "conflict", "Class is full"],
    [402, "payment_required", "Empty pack"],
  ])("does not report an HttpError %i", async (status, code, message) => {
    const fn = () => Promise.reject(new HttpError(status, code, message));
    const response = await handle(fn);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code, message } });
    expect(capture).not.toHaveBeenCalled();
  });

  it("does not report anything when the handler resolves", async () => {
    const response = await handle(() =>
      Promise.resolve(new Response("ok", { status: 200 })),
    );

    expect(response.status).toBe(200);
    expect(capture).not.toHaveBeenCalled();
  });
});
