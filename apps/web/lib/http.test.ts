import { describe, it, expect } from "vitest";
import { z } from "zod";
import { handle, HttpError, ApiErrorBody } from "@/lib/http";
import { NextResponse } from "next/server";

describe("handle() with ZodError", () => {
  it("returns HTTP 400 with validation error envelope for ZodError", async () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
    });

    const response = await handle(async () => {
      const data = { email: "invalid-email", name: "John" };
      schema.parse(data);
      return new NextResponse("OK");
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect((body.error.details as Array<unknown>).length).toBeGreaterThan(0);
  });

  it("includes path and message in validation error details", async () => {
    const schema = z.object({
      email: z.string().email(),
    });

    const response = await handle(async () => {
      schema.parse({ email: "not-an-email" });
      return new NextResponse("OK");
    });

    const body = (await response.json()) as ApiErrorBody;
    const details = body.error.details as Array<{ path: (string | number)[]; message: string }>;
    expect(details[0]).toHaveProperty("path");
    expect(details[0]).toHaveProperty("message");
  });
});

describe("handle() with HttpError", () => {
  it("maps HttpError to the corresponding status and error envelope", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Resource not found");
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Resource not found");
  });

  it("includes details in HttpError envelope when provided", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Resource already exists", {
        existingId: "123",
      });
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("conflict");
    expect(body.error.details).toEqual({ existingId: "123" });
  });
});

describe("handle() with unexpected error", () => {
  it("returns HTTP 500 for unexpected errors", async () => {
    const response = await handle(async () => {
      throw new Error("Something unexpected");
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("Something went wrong");
  });
});
