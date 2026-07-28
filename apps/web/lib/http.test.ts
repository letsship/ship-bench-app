import { describe, expect, it } from "vitest";
import { z } from "zod";

import { HttpError, handle, ok } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("maps a ZodError to the 400 bad_request envelope with details", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
      return ok({});
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);
    expect(body.error.details[0]).toMatchObject({ path: ["email"] });
    expect(typeof body.error.details[0].message).toBe("string");
  });

  it("maps non-schema ZodErrors too", async () => {
    const response = await handle(async () => {
      z.object({ count: z.number().int() }).parse({ count: 1.5 });
      return ok({});
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("maps HttpError to its own envelope", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Already exists", { id: "x" });
    });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "conflict", message: "Already exists", details: { id: "x" } } });
  });

  it("maps unexpected errors to the 500 envelope", async () => {
    const response = await handle(async () => {
      throw new Error("boom");
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("Something went wrong");
  });
});
