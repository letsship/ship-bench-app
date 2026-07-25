import { describe, it, expect } from "vitest";
import { z } from "zod";
import { handle, ApiErrorBody } from "./http";

describe("handle() error envelope", () => {
  it("translates a ZodError into a 400 'Validation failed' response", async () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
    });

    const response = await handle(() => {
      throw schema.parse({ email: "not-an-email", name: "John" });
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toBeDefined();
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("includes path and message in validation error details", async () => {
    const schema = z.object({
      email: z.string().email("Invalid email format"),
      age: z.number().min(0, "Age must be non-negative"),
    });

    const response = await handle(() => {
      throw schema.parse({
        email: "bad-email",
        age: -5,
      });
    });

    const body = (await response.json()) as ApiErrorBody;
    const details = body.error.details as Array<{
      path: (string | number)[];
      message: string;
    }>;

    const emailError = details.find((d) => d.path[0] === "email");
    const ageError = details.find((d) => d.path[0] === "age");

    expect(emailError).toBeDefined();
    expect(emailError?.message).toContain("email");
    expect(ageError).toBeDefined();
    expect(ageError?.message).toContain("non-negative");
  });
});
