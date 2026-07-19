import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle with ZodError", () => {
  it("maps a ZodError to a 400 validation envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({
        email: "not-a-valid-email",
      });
      return new Response("ok");
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: { code: string; message: string; details: unknown };
    };

    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);

    const details = body.error.details as Array<{ path: unknown; message: string }>;
    expect(details.length).toBeGreaterThan(0);
    expect(details[0]).toHaveProperty("path");
    expect(details[0]).toHaveProperty("message");
  });
});
