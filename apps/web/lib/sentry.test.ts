import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

const originalSentryDsn = process.env.SENTRY_DSN;

describe("reportUnexpectedError", () => {
  let reportUnexpectedError: (error: unknown) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    vi.resetModules();
    ({ reportUnexpectedError } = await import("./sentry"));
  });

  afterEach(() => {
    if (originalSentryDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalSentryDsn;
  });

  it("captures the error and waits for Sentry to flush", async () => {
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    vi.resetModules();
    ({ reportUnexpectedError } = await import("./sentry"));

    let resolveFlush!: (value: boolean) => void;
    sentry.flush.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveFlush = resolve;
      }),
    );
    const error = new Error("unexpected failure");
    let completed = false;
    const reporting = reportUnexpectedError(error).then(() => {
      completed = true;
    });

    await Promise.resolve();

    expect(sentry.init).toHaveBeenCalledWith({ dsn: process.env.SENTRY_DSN });
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.flush).toHaveBeenCalledWith(2000);
    expect(completed).toBe(false);

    resolveFlush(true);
    await reporting;
    expect(completed).toBe(true);
  });

  it("does nothing when SENTRY_DSN is unset", async () => {
    await expect(reportUnexpectedError(new Error("unexpected failure"))).resolves.toBeUndefined();

    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.flush).not.toHaveBeenCalled();
  });
});
