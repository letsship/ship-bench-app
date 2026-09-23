import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportUnexpectedError } from "./sentry";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("reportUnexpectedError", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockReset();
  });

  it("forwards the exact error to Sentry", () => {
    const error = new Error("unexpected failure");

    reportUnexpectedError(error);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("logs and swallows Sentry reporting failures", () => {
    const reportingError = new Error("Sentry unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(Sentry.captureException).mockImplementation(() => {
      throw reportingError;
    });

    expect(() => reportUnexpectedError(new Error("unexpected failure"))).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to report unexpected error to Sentry",
      reportingError,
    );
    consoleError.mockRestore();
  });
});
