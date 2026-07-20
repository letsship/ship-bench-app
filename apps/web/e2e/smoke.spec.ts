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

  test("the public studio page is accessible without login", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Riverbank Movement").first()).toBeVisible();
  });

  test("the public studio page renders upcoming classes", async ({ page }) => {
    await page.goto("/s/riverbank");
    const classes = page.locator("text=with").first();
    await expect(classes).toBeVisible();
  });

  test("the public studio page has a descriptive CTA", async ({ page }) => {
    await page.goto("/s/riverbank");
    const cta = page.getByRole("link", { name: /Book a class at/ });
    await expect(cta).toBeVisible();
  });

  test("an unknown studio slug returns 404", async ({ page }) => {
    const response = await page.goto("/s/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("the login stub signs the operator in and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("operator@riverbank.studio");
    await page.getByRole("button", { name: "Send magic link" }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Today at the studio" })).toBeVisible();
    await expect(page.getByText("operator@riverbank.studio")).toBeVisible();
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
