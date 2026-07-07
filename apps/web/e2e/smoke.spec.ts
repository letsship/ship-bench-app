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

// Regression: a front-desk laptop set to a non-studio timezone (e.g.
// America/Los_Angeles) used to render the wrong day in the header and trip a
// React hydration error, because the date was computed client-side with the
// visitor's own clock/timezone. The header is now server-rendered in the
// studio's configured Europe/Amsterdam timezone from a single per-request
// instant, so the browser's timezone must not affect it.
test("the dashboard header shows the studio-timezone day on a US-timezone client", async ({ browser }) => {
  const expectedLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Amsterdam",
  }).format(new Date());

  const context = await browser.newContext({ timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);
  await expect(page.getByRole("heading", { name: "Today at the studio" })).toBeVisible();

  // The header subtitle is the Amsterdam calendar day, regardless of the
  // browser's America/Los_Angeles timezone.
  await expect(page.locator("h1").locator("xpath=following-sibling::p").first()).toHaveText(
    expectedLabel,
  );

  expect(errors).toEqual([]);

  await context.close();
});
