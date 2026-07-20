import { describe, it, expect } from "vitest";
import { z } from "zod";
import { handle, HttpError } from "./http";

describe("Error envelope", () => {
  it("maps a ZodError to a 400 bad_request with details", async () => {
    const schema = z.object({
      email: z.string().email(),
    });

    const response = await handle(async () => {
      throw schema.parse({ email: "not-an-email" });
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toBeDefined();
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("maps HttpError to its status and code", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Resource not found");
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Resource not found");
  });

  it("maps unknown errors to 500 internal_error", async () => {
    const response = await handle(async () => {
      throw new Error("Something went wrong");
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("Something went wrong");
  });

  it("returns successful responses unchanged", async () => {
    const response = await handle(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
