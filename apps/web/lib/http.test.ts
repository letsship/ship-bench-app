import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { handle, HttpError, ok, apiError } from "./http";

describe("handle", () => {
  it("maps a ZodError to a 400 bad_request envelope", async () => {
    const zodError = new ZodError([
      { code: "invalid_string", message: "Invalid email", path: ["email"] },
    ]);

    const res = await handle(() => {
      throw zodError;
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({
      error: { code: "bad_request", message: "Validation failed" },
    });
    expect(body.error.details).toBeInstanceOf(Array);
    expect(body.error.details[0]).toMatchObject({
      path: ["email"],
      message: "Invalid email",
    });
  });

  it("maps an HttpError to its status and code", async () => {
    const res = await handle(() => {
      throw new HttpError(404, "not_found", "Member not found");
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({
      error: { code: "not_found", message: "Member not found" },
    });
  });

  it("maps an unknown error to a 500 internal_error", async () => {
    const res = await handle(() => {
      throw new Error("Database connection lost");
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({
      error: { code: "internal_error", message: "Something went wrong" },
    });
  });

  it("returns the response from a successful handler", async () => {
    const res = await handle(() => ok({ id: "1" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "1" });
  });
});

describe("HttpError", () => {
  it("creates an error with status, code, and message", () => {
    const err = new HttpError(400, "bad_request", "Bad input");
    expect(err.status).toBe(400);
    expect(err.code).toBe("bad_request");
    expect(err.message).toBe("Bad input");
    expect(err.name).toBe("HttpError");
  });
});

describe("ok", () => {
  it("returns a 200 JSON response by default", async () => {
    const res = ok({ foo: "bar" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ foo: "bar" });
  });
});

describe("apiError", () => {
  it("returns a JSON error envelope with the given status and code", async () => {
    const res = apiError(409, "conflict", "Resource conflict");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "conflict", message: "Resource conflict" },
    });
  });
});