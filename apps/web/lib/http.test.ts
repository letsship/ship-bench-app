import { describe, expect, it, vi } from "vitest";
import { createMemberSchema } from "./validation";
import { HttpError, handle } from "./http";

describe("handle", () => {
  it("maps Zod validation failures to the bad request envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Amara", email: "not-an-email" });
      return new Response();
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

  it("maps HttpError values to their status and code", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Already exists", { memberId: "member-1" });
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "conflict",
        message: "Already exists",
        details: { memberId: "member-1" },
      },
    });
  });

  it("maps unknown errors to the internal error envelope", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await handle(async () => {
      throw new Error("Unexpected");
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "internal_error",
        message: "Something went wrong",
      },
    });
    expect(errorSpy).toHaveBeenCalledWith("Unhandled API error", expect.any(Error));
    errorSpy.mockRestore();
  });
});
