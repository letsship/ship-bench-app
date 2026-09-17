import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

const originalDsn = process.env.SENTRY_DSN;

beforeEach(() => {
  vi.resetModules();
  sentry.init.mockReset();
  sentry.captureException.mockReset();
  sentry.flush.mockReset();
});

afterEach(() => {
  if (originalDsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = originalDsn;
});

describe("reportUnexpectedError", () => {
  it("does nothing when SENTRY_DSN is not configured", async () => {
    delete process.env.SENTRY_DSN;
    const { reportUnexpectedError } = await import("./sentry");

    await reportUnexpectedError(new Error("unexpected"));

    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.flush).not.toHaveBeenCalled();
  });

  it("initializes once, captures each error, and waits for Sentry to flush", async () => {
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    let resolveFlush: (() => void) | undefined;
    sentry.flush.mockImplementation(
      () => new Promise<void>((resolve) => (resolveFlush = resolve)),
    );
    const { reportUnexpectedError } = await import("./sentry");
    const firstError = new Error("first");
    let resolved = false;

    const report = reportUnexpectedError(firstError).then(() => {
      resolved = true;
    });
    await Promise.resolve();

    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.init).toHaveBeenCalledWith({ dsn: process.env.SENTRY_DSN });
    expect(sentry.captureException).toHaveBeenCalledWith(firstError);
    expect(sentry.flush).toHaveBeenCalledWith(2000);
    expect(resolved).toBe(false);

    resolveFlush?.();
    await report;

    sentry.flush.mockResolvedValue(true);
    await reportUnexpectedError(new Error("second"));
    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });
});
