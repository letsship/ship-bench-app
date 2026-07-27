import { describe, expect, it } from "vitest";
import { handle, HttpError } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("maps a thrown ZodError to a 400 validation envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Jane", email: "not-an-email" });
      return new Response(null);
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details[0]).toMatchObject({ path: ["email"] });
  });

  it("maps a thrown HttpError to its own status/code/details envelope", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Already booked", { sessionId: "abc" });
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toEqual({
      code: "conflict",
      message: "Already booked",
      details: { sessionId: "abc" },
    });
  });

  it("maps an unexpected error to a 500 envelope", async () => {
    const response = await handle(async () => {
      throw new Error("boom");
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toEqual({ code: "internal_error", message: "Something went wrong" });
  });
});
