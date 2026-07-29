import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { handle } from "./http";

describe("handle", () => {
  it("maps a ZodError to a 400 bad_request envelope with details", async () => {
    const schema = z.object({ email: z.string().email() });
    const fn = vi.fn(async () => {
      schema.parse({ email: "bad" });
      return new Response("OK");
    });

    const res = await handle(fn);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "bad_request",
        message: "Validation failed",
      },
    });
    expect(body.error.details).toBeInstanceOf(Array);
    expect(body.error.details[0]).toHaveProperty("path");
    expect(body.error.details[0]).toHaveProperty("message");
  });
});