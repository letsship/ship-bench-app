import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpError, handle } from "./http";

describe("handle", () => {
  it("maps a ZodError to a 400 with flattened details", async () => {
    const schema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });

    const response = await handle(async () => {
      schema.parse({ email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toEqual({
      formErrors: [],
      fieldErrors: { email: expect.any(Array) },
    });
  });

  it("maps an HttpError to its own status and code", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toEqual({
      code: "not_found",
      message: "Member not found",
      details: undefined,
    });
  });

  it("maps an unknown error to a 500 internal_error", async () => {
    const response = await handle(async () => {
      throw new Error("boom");
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });
});
