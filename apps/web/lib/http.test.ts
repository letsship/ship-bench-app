import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handle, HttpError, ApiErrorBody } from "./http";

describe("handle() error envelope", () => {
  it("converts a ZodError into a 400 bad_request response", async () => {
    const schema = z.object({ email: z.string().email() });

    const response = await handle(async () => {
      schema.parse({ email: "invalid" });
      throw new Error("Should not reach here");
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("includes validation details in the error response", async () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
    });

    const response = await handle(async () => {
      schema.parse({ email: "invalid", name: "" });
      throw new Error("Should not reach here");
    });

    const body = (await response.json()) as ApiErrorBody;
    const details = body.error.details as Array<{ path: (string | number)[]; message: string }>;
    expect(details).toBeDefined();
    expect(details.length).toBeGreaterThan(0);
    expect(details[0]).toHaveProperty("path");
    expect(details[0]).toHaveProperty("message");
  });

  it("passes through HttpError unchanged", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Resource already exists", { resourceId: "123" });
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toBe("Resource already exists");
    expect(body.error.details).toEqual({ resourceId: "123" });
  });

  it("returns 500 for unhandled errors", async () => {
    const response = await handle(async () => {
      throw new Error("Unexpected error");
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("internal_error");
  });
});
