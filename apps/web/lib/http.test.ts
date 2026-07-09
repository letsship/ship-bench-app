import { describe, expect, it } from "vitest";
import { handle, HttpError } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("turns a thrown ZodError into a bad_request envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string; details: unknown };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toEqual([{ path: ["email"], message: "Invalid email address" }]);
  });

  it("turns a thrown HttpError into its own envelope", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error).toEqual({
      code: "not_found",
      message: "Member not found",
      details: undefined,
    });
  });

  it("turns an unknown error into a 500 internal_error", async () => {
    const response = await handle(async () => {
      throw new Error("boom");
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("internal_error");
  });
});
