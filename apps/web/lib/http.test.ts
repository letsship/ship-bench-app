import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpError, handle } from "./http";

async function body(response: Response): Promise<{
  error: { code: string; message: string; details?: unknown };
}> {
  return (await response.json()) as {
    error: { code: string; message: string; details?: unknown };
  };
}

describe("handle()", () => {
  it("turns a thrown ZodError into a 400 bad_request envelope", async () => {
    const schema = z.object({ email: z.string().email() });
    const response = await handle(async () => {
      schema.parse({ email: "not-an-email" });
      return new Response("ok");
    });

    expect(response.status).toBe(400);
    const json = await body(response);
    expect(json.error.code).toBe("bad_request");
    expect(json.error.message).toBe("Validation failed");
    expect(json.error.details).toEqual([
      { path: ["email"], message: expect.any(String) },
    ]);
  });

  it("turns a thrown ZodError with a top-level issue into an empty path detail", async () => {
    const schema = z.string().email();
    const response = await handle(async () => {
      schema.parse("nope");
      return new Response("ok");
    });

    expect(response.status).toBe(400);
    const json = await body(response);
    expect(json.error.code).toBe("bad_request");
    expect(json.error.details).toEqual([
      { path: [], message: expect.any(String) },
    ]);
  });

  it("maps an HttpError to its status code and envelope", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "Member missing");
    });

    expect(response.status).toBe(404);
    const json = await body(response);
    expect(json.error).toEqual({ code: "not_found", message: "Member missing" });
  });

  it("maps an HttpError with details", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Duplicate", { field: "email" });
    });

    expect(response.status).toBe(409);
    const json = await body(response);
    expect(json.error).toEqual({
      code: "conflict",
      message: "Duplicate",
      details: { field: "email" },
    });
  });

  it("maps an unknown error to a 500 internal_error envelope and logs it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handle(async () => {
      throw new Error("boom");
    });

    expect(response.status).toBe(500);
    const json = await body(response);
    expect(json.error).toEqual({ code: "internal_error", message: "Something went wrong" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("passes through the response when the handler succeeds", async () => {
    const response = await handle(async () => new Response("ok", { status: 200 }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});
