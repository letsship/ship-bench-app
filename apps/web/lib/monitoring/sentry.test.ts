import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const captureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({ init, captureException }));

describe("reportUnexpectedError", () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    init.mockClear();
    captureException.mockClear();
  });

  afterEach(() => {
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
  });

  it("captures the error via Sentry when SENTRY_DSN is configured", async () => {
    process.env.SENTRY_DSN = "https://example@o0.ingest.sentry.io/1";
    const { reportUnexpectedError } = await import("./sentry");
    const error = new Error("boom");

    reportUnexpectedError(error);

    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://example@o0.ingest.sentry.io/1" }),
    );
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("does not throw or report when SENTRY_DSN is unset", async () => {
    delete process.env.SENTRY_DSN;
    const { reportUnexpectedError } = await import("./sentry");

    expect(() => reportUnexpectedError(new Error("boom"))).not.toThrow();
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });
});
