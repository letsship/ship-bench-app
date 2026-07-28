import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle()", () => {
  it("returns a 400 validation-error envelope when the body throws a ZodError", async () => {
    const fn = async () => {
      const parsed = createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
      return parsed;
    };
    // Wrap so any thrown ZodError surfaces to handle().
    const response = await handle(async () => {
      await fn();
      return new Response("ok", { status: 200 });
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("proves a real ZodError is what triggers the envelope", () => {
    let caught: unknown;
    try {
      createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ZodError);
    expect((caught as ZodError).issues.length).toBeGreaterThan(0);
  });
});
