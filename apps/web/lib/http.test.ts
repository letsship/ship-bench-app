import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpError, handle } from "./http";

describe("handle", () => {
  it("turns a thrown ZodError into a 400 bad_request envelope with details", async () => {
    const schema = z.object({ email: z.email() });

    const response = await handle(async () => {
      schema.parse({ email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it("maps a plain HttpError to its own status and code", async () => {
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
});
