import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ init: vi.fn(), captureException: vi.fn() }));

describe("captureUnexpectedError", () => {
  beforeEach(() => {
    vi.mocked(Sentry.init).mockClear();
    vi.mocked(Sentry.captureException).mockClear();
    vi.resetModules();
  });

  it("forwards the exact error to Sentry.captureException", async () => {
    const { captureUnexpectedError } = await import("./sentry");
    const error = new Error("boom");
    captureUnexpectedError(error);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("initializes Sentry from SENTRY_DSN only once across multiple calls", async () => {
    const { captureUnexpectedError } = await import("./sentry");
    captureUnexpectedError(new Error("first"));
    captureUnexpectedError(new Error("second"));
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith({ dsn: process.env.SENTRY_DSN });
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
  });
});
