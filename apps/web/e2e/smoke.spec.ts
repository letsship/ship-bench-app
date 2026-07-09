import { expect, test } from "@playwright/test";
import { resetBackend } from "./support/auth";

// Pre-auth flows: these start signed OUT, so they override the project's
// storageState with an empty session.
test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("landing page renders the Studiobook marketing hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Run your studio/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("visiting a protected page redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the login stub signs the operator in and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("operator@riverbank.studio");
    await page.getByRole("button", { name: "Send magic link" }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Today at the studio" })).toBeVisible();
    await expect(page.getByText("operator@riverbank.studio")).toBeVisible();
  });

  test("the public studio page renders without a session, is indexable, and carries Event JSON-LD", async ({
    page,
  }) => {
    const response = await page.goto("/s/riverbank");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Riverbank Movement", { exact: true })).toBeVisible();
    await expect(page.getByText("Upcoming classes")).toBeVisible();
    await expect(page).toHaveTitle(/Riverbank Movement/);

    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toContain("Riverbank Movement");
    const robotsTag = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robotsTag ?? "").not.toContain("noindex");
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain("/s/riverbank");

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const events = JSON.parse(jsonLd ?? "[]");
    expect(Array.isArray(events)).toBe(true);
    expect(events[0]).toMatchObject({ "@type": "Event" });
    expect(events[0].name).toBeTruthy();
    expect(events[0].startDate).toBeTruthy();
    expect(events[0].location).toBeTruthy();

    await expect(page.locator("img").first()).toHaveAttribute("alt", /Riverbank Movement/);
    await expect(page.getByRole("link", { name: /Sign in to book a class/i })).toBeVisible();
  });

  test("an unknown studio slug 404s", async ({ page }) => {
    const response = await page.goto("/s/no-such-studio");
    expect(response?.status()).toBe(404);
  });

  test("/sitemap.xml lists the public studio page", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("/s/riverbank");
  });

  test("/robots.txt allows crawling and references the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/Allow: \//);
    expect(body).toContain("Sitemap:");
    expect(body).toContain("/sitemap.xml");
  });
});

// Authenticated smoke: session comes from the `setup` project's storageState; a
// per-test reset gives the mutating "schedule a class" test a clean store.
test.describe("authenticated (seeded studio)", () => {
  test.beforeEach(async ({ request }) => {
    await resetBackend(request);
  });

  test("the dashboard shows seeded classes and stats", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Active members")).toBeVisible();
    await expect(page.getByTestId("today-classes")).toBeVisible();
    await expect(page.getByTestId("today-classes").locator("tbody tr").first()).toBeVisible();
  });

  test("an operator can schedule a new class from the UI", async ({ page }) => {
    await page.goto("/classes");
    const form = page.getByRole("form", { name: "Add class" });
    await form.getByLabel("Instructor").fill("E2E Tester");
    await form.getByRole("button", { name: "Schedule class" }).click();
    await expect(page.getByTestId("schedule").getByText("E2E Tester").first()).toBeVisible();
  });

  test("the dashboard renders with zero console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Today at the studio" })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
