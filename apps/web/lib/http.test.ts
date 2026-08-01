import { describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";
import { HttpError, handle } from "./http";

describe("handle", () => {
  it("maps ZodErrors to the validation error envelope", async () => {
    const response = await handle(async () => {
      z.object({ email: z.email() }).parse({ email: "invalid" });
      return new Response(null);
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "bad_request",
        message: "Validation failed",
        details: [{ path: ["email"], message: "Invalid email address" }],
      },
    });
  });

  it("maps HttpErrors to their existing status and details", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Already exists", { id: "member-1" });
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "conflict",
        message: "Already exists",
        details: { id: "member-1" },
      },
    });
  });

  it("maps unexpected errors to an internal error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await handle(async () => {
        throw new Error("boom");
      });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: { code: "internal_error", message: "Something went wrong" },
      });
      expect(consoleError).toHaveBeenCalledWith("Unhandled API error", expect.any(Error));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("recognizes ZodError instances from the installed Zod version", () => {
    expect(new ZodError([])).toBeInstanceOf(ZodError);
  });
});
