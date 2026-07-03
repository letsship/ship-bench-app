import { NextResponse } from "next/server";
import { ZodError } from "zod";

// A consistent JSON error envelope for every API route: { error: { code,
// message, details? } }. Domain code throws HttpError; the handle() wrapper
// turns thrown errors (including Zod validation errors) into that envelope.

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export const notFound = (message = "Not found"): NextResponse =>
  apiError(404, "not_found", message);
export const badRequest = (message: string, details?: unknown): NextResponse =>
  apiError(400, "bad_request", message, details);
export const unauthorized = (message = "Sign in required"): NextResponse =>
  apiError(401, "unauthorized", message);
export const conflict = (message: string, details?: unknown): NextResponse =>
  apiError(409, "conflict", message, details);

// Run an async route body, translating known error types into the envelope and
// logging (never swallowing) anything unexpected. Accepts any Response so
// handlers can return non-JSON bodies (CSV, iCalendar).
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest("Validation failed", error.flatten());
    }
    if (error instanceof HttpError) {
      return apiError(error.status, error.code, error.message, error.details);
    }
    console.error("Unhandled API error", error);
    return apiError(500, "internal_error", "Something went wrong");
  }
}
