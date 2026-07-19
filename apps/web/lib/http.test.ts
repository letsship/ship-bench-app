import { describe, it, expect } from "vitest";
import { z } from "zod";
import { handle, ApiErrorBody } from "./http";

describe("handle() error envelope", () => {
  it("maps a ZodError to a 400 bad_request response", async () => {
    const schema = z.object({
      email: z.email(),
    });

    const fn = async () => {
      schema.parse({ email: "invalid-email" });
    };

    const response = await handle(fn);
    expect(response.status).toBe(400);

    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toBeDefined();
  });

  it("includes field errors in the details", async () => {
    const schema = z.object({
      email: z.email(),
      age: z.number().min(0),
    });

    const fn = async () => {
      schema.parse({ email: "not-an-email", age: -5 });
    };

    const response = await handle(fn);
    const body = (await response.json()) as ApiErrorBody;

    expect(body.error.details).toBeDefined();
    const details = body.error.details as Record<string, unknown>;
    expect(details.fieldErrors).toBeDefined();
  });

  it("preserves the error envelope for valid requests", async () => {
    const fn = async () => {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };

    const response = await handle(fn);
    expect(response.status).toBe(200);
  });
});
