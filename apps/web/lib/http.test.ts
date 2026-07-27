import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { handle, HttpError, ApiErrorBody } from "./http";
import { NextResponse } from "next/server";

// Mock NextResponse to capture the response details without network/server overhead
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      status: options?.status || 200,
      data,
      json: async () => data,
    }),
  },
}));

describe("handle() with ZodError", () => {
  it("converts ZodError to 400 bad_request with validation failure details", async () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
    });

    const response = await handle(async () => {
      schema.parse({
        email: "invalid-email",
        name: "",
      });
      return new NextResponse();
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
      email: z.string().email(),
    });

    const response = await handle(async () => {
      schema.parse({ email: "not-an-email" });
      return new NextResponse();
    });

    const body = (await response.json()) as ApiErrorBody;
    const details = body.error.details as Array<{ path: string[]; message: string }>;
    expect(details).toHaveLength(1);
    expect(details[0].path).toEqual(["email"]);
    expect(details[0].message).toBeDefined();
  });
});

describe("handle() with HttpError", () => {
  it("passes through HttpError status, code, and message", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Resource does not exist", {
        resourceId: "abc-123",
      });
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Resource does not exist");
    expect(body.error.details).toEqual({ resourceId: "abc-123" });
  });

  it("passes through HttpError with 409 conflict", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Name already exists");
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("conflict");
  });
});

describe("handle() with unknown errors", () => {
  it("converts unknown error to 500 internal_error", async () => {
    const response = await handle(async () => {
      throw new Error("Something unexpected happened");
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("Something went wrong");
  });
});

describe("handle() success path", () => {
  it("returns the response from the wrapped function on success", async () => {
    const expectedData = { id: "123", name: "Test" };
    const response = await handle(async () => {
      return NextResponse.json(expectedData, { status: 201 });
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual(expectedData);
  });
});
