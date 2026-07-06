import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

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
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Today at the studio" })).toBeVisible();
  await expect(page.getByText("operator@riverbank.studio")).toBeVisible();
});

test("the dashboard shows seeded classes and stats", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText("Active members")).toBeVisible();
  // The seed always schedules classes for today.
  await expect(page.getByTestId("today-classes")).toBeVisible();
  await expect(page.getByTestId("today-classes").locator("tbody tr").first()).toBeVisible();
});

test("an operator can schedule a new class from the UI", async ({ page }) => {
  await signIn(page);
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

  await signIn(page);
  await expect(page.getByRole("heading", { name: "Today at the studio" })).toBeVisible();

  expect(errors).toEqual([]);
});

// Reproduces the support report from the front-desk laptop set to a US
// timezone while the studio (Europe/Amsterdam) is on a different calendar
// day. The "Today at the studio" subtitle must follow the studio's timezone,
// not the browser's, and the page must still hydrate cleanly (no console or
// pageerror events).
test.describe("dashboard header with a US browser timezone", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("shows the studio-local date and emits no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await signIn(page);
    const heading = page.getByRole("heading", { name: "Today at the studio" });
    await expect(heading).toBeVisible();

    // The studio is seeded in Europe/Amsterdam; the subtitle is the studio-local
    // "today" regardless of the browser's America/Los_Angeles timezone.
    const expected = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Amsterdam",
    }).format(new Date());
    await expect(heading.locator("xpath=following-sibling::p")).toHaveText(expected);

    expect(errors).toEqual([]);
  });
});
