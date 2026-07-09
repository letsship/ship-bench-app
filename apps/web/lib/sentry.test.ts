import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const captureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({ init, captureException }));

describe("reportUnexpectedError", () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    init.mockReset();
    captureException.mockReset();
  });

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn;
  });

  it("captures the error, and skips init when no DSN is configured", async () => {
    delete process.env.SENTRY_DSN;
    const { reportUnexpectedError } = await import("./sentry");
    const error = new Error("boom");

    reportUnexpectedError(error);

    expect(init).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("initializes Sentry once with the configured DSN", async () => {
    process.env.SENTRY_DSN = "https://key@o0.ingest.sentry.io/0";
    const { reportUnexpectedError } = await import("./sentry");

    reportUnexpectedError(new Error("first"));
    reportUnexpectedError(new Error("second"));

    expect(init).toHaveBeenCalledExactlyOnceWith({ dsn: "https://key@o0.ingest.sentry.io/0" });
    expect(captureException).toHaveBeenCalledTimes(2);
  });
});
