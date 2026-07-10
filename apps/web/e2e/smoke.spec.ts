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

test("an invoice line-item description containing HTML renders as literal text, not markup", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  const payload = '<img src=x onerror="alert(document.cookie)">';

  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").first().fill(payload);
  await form.getByLabel("Unit price").first().fill("10.00");

  await form.getByRole("button", { name: "+ Add line" }).click();
  await form.getByPlaceholder("Description").nth(1).fill("Studio rental");
  await form.getByLabel("Unit price").nth(1).fill("25.00");

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/invoices") && response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Issue invoice" }).click();
  const invoiceId = (await responsePromise.then((response) => response.json())).invoice.id;

  await page.goto(`/invoices/${invoiceId}`);

  const table = page.locator("table.sb-table");
  const rows = table.locator("tbody tr");
  const payloadCell = rows.nth(0).locator("td").first();
  const plainCell = rows.nth(1).locator("td").first();

  await expect(payloadCell).toContainText(payload);
  await expect(payloadCell.locator("img")).toHaveCount(0);
  await expect(plainCell).toContainText("Studio rental");

  expect(dialogs).toEqual([]);
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
