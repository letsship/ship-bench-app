import { describe, expect, it } from "vitest";
import { HttpError, handle, ok } from "./http";
import { createMemberSchema } from "./validation";

// handle() builds the shared validation-error envelope from a thrown ZodError.
// The Zod 4 upgrade changed that error surface, so pin the exact envelope.

describe("handle", () => {
  it("passes a successful response through", async () => {
    const response = await handle(async () => ok({ hello: "world" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hello: "world" });
  });

  it("turns a schema parse failure into the bad_request envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
      return ok({ unreachable: true });
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string; details: { path: unknown[]; message: string }[] };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details.length).toBeGreaterThan(0);
    expect(body.error.details[0]).toEqual({
      path: ["email"],
      message: expect.any(String),
    });
  });

  it("reports every failing field", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "", email: "nope" });
      return ok({ unreachable: true });
    });

    const body = (await response.json()) as {
      error: { details: { path: string[]; message: string }[] };
    };
    expect(body.error.details.map((detail) => detail.path)).toEqual([["name"], ["email"]]);
  });

  it("maps an HttpError onto its own status and code", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Session is full", { capacity: 12 });
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: { code: "conflict", message: "Session is full", details: { capacity: 12 } },
    });
  });
});
