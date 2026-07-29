import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handle, type ApiErrorBody } from "./http";

describe("handle() ZodError mapping", () => {
  it("maps a thrown ZodError to a 400 bad_request envelope", async () => {
    const schema = z.object({ email: z.string().email() });

    const res = await handle(async () => {
      schema.parse({ email: "not-an-email" });
      return new Response("ok");
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect((body.error.details as Array<{ path: PropertyKey[]; message: string }>).length).toBeGreaterThan(0);
  });

  it("passes through a successful Response unchanged", async () => {
    const res = await handle(async () => new Response("ok", { status: 200 }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
