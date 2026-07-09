import { expect, test } from "@playwright/test";

// robots.txt is public, so run signed out rather than inheriting the
// authenticated `chromium` project's storageState.
test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("GET /robots.txt allows crawling of public pages", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");

    const body = await response.text();
    expect(body).toContain("User-Agent: *");
    expect(body).toContain("Allow: /");
  });
});
