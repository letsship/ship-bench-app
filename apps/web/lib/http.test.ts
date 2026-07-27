import { describe, expect, it } from "vitest";
import { HttpError, handle } from "./http";
import { createMemberSchema } from "./validation";

interface ErrorEnvelope {
  error: { code: string; message: string; details?: { path: unknown[]; message: string }[] };
}

describe("handle() with a ZodError", () => {
  const failing = () =>
    handle(async () => {
      createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
      throw new Error("unreachable");
    });

  it("returns a 400 bad_request validation envelope", async () => {
    const res = await failing();
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
  });

  it("reports each issue with its path and message", async () => {
    const res = await failing();
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.details).toBeDefined();
    expect(body.error.details?.length).toBeGreaterThan(0);
    expect(body.error.details?.[0]).toEqual({
      path: ["email"],
      message: expect.any(String) as unknown as string,
    });
  });
});

describe("handle() with other errors", () => {
  it("passes an HttpError through with its status, code and details", async () => {
    const res = await handle(async () => {
      throw new HttpError(409, "conflict", "Session is full", { capacity: 8 });
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error).toMatchObject({ code: "conflict", message: "Session is full" });
  });

  it("returns the response when nothing throws", async () => {
    const res = await handle(async () => Response.json({ ok: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
