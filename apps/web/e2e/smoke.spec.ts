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

  test("public pages link a favicon and web app manifest", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.ico");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.json");

    await page.goto("/login");
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.ico");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.json");

    expect((await request.get("/favicon.ico")).status()).toBe(200);
    expect((await request.get("/manifest.json")).status()).toBe(200);
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
