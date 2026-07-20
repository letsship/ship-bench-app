import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSession,
  startSession,
  endSession,
  createSessionToken,
  verifySessionToken,
} from "./session";

// Mock next/headers
vi.mock("next/headers");

type MockCookieStore = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe("session helpers", () => {
  let mockCookieStore: MockCookieStore;

  beforeEach(async () => {
    mockCookieStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    // Mock cookies() to return a Promise that resolves to the mock store
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as MockCookieStore);
  });

  it("getSession returns null when no session cookie exists", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const session = await getSession();

    expect(session).toBeNull();
    expect(mockCookieStore.get).toHaveBeenCalledWith("studiobook_session");
  });

  it("getSession returns session when cookie exists with valid token", async () => {
    const token = await createSessionToken("test@example.com");
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.email).toBe("test@example.com");
  });

  it("getSession returns null when cookie token is invalid", async () => {
    mockCookieStore.get.mockReturnValue({ value: "invalid.token" });

    const session = await getSession();

    expect(session).toBeNull();
  });

  it("startSession sets the session cookie", async () => {
    const email = "operator@riverbank.studio";

    await startSession(email);

    expect(mockCookieStore.set).toHaveBeenCalled();
    const [cookieName, cookieValue, cookieOptions] = mockCookieStore.set.mock.calls[0];
    expect(cookieName).toBe("studiobook_session");
    expect(cookieValue).toBeDefined();
    expect(cookieOptions).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // Verify the cookie value is a valid token
    const session = await verifySessionToken(cookieValue);
    expect(session?.email).toBe(email);
  });

  it("endSession deletes the session cookie", async () => {
    await endSession();

    expect(mockCookieStore.delete).toHaveBeenCalledWith("studiobook_session");
  });
});
