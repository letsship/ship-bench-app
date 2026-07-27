import { describe, it, expect } from "vitest";
import { z } from "zod";
import { handle } from "./http";

describe("http.handle", () => {
  it("returns 400 bad_request with details for ZodError", async () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().int().min(0),
    });

    const response = await handle(async () => {
      schema.parse({ email: "invalid-email", age: -1 });
      throw new Error("Should not reach here");
    });

    const status = response.status;
    const body = await response.json();

    expect(status).toBe(400);
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);

    // Verify structure of details
    const detail = body.error.details[0];
    expect(typeof detail.path).toBe("object");
    expect(typeof detail.message).toBe("string");
  });

  it("includes correct error details for multiple validation issues", async () => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    const response = await handle(async () => {
      schema.parse({ name: "", email: "not-an-email" });
      throw new Error("Should not reach here");
    });

    const body = await response.json();

    expect(body.error.details.length).toBeGreaterThanOrEqual(2);
    const paths = body.error.details.map((d: { path: unknown[] }) => d.path[0]);
    expect(paths).toContain("name");
    expect(paths).toContain("email");
  });
});
