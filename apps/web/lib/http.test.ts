import { describe, it, expect } from "vitest";
import { z } from "zod";
import { handle, ApiErrorBody } from "./http";
import { NextResponse } from "next/server";

describe("http error handling", () => {
  it("converts ZodError to bad_request envelope", async () => {
    const schema = z.object({
      email: z.string().email(),
    });

    const response = (await handle(async () => {
      throw schema.parse({ email: "invalid-email" });
    })) as NextResponse<ApiErrorBody>;

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toBeDefined();
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("includes path and message in validation error details", async () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().int().min(18),
    });

    const response = (await handle(async () => {
      throw schema.parse({ email: "invalid", age: "not-a-number" });
    })) as NextResponse<ApiErrorBody>;

    const body = (await response.json()) as ApiErrorBody;
    const details = body.error.details as Array<{ path: (string | number)[]; message: string }>;
    expect(details.length).toBeGreaterThan(0);
    expect(details.some((d) => d.path.includes("email"))).toBe(true);
  });
});
