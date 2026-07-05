import { type Page, expect, test } from "@playwright/test";

// The seeded studio (Riverbank Movement) is configured for Europe/Amsterdam
// regardless of the browser's timezone.
const STUDIO_TIME_ZONE = "Europe/Amsterdam";

function studioDayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: STUDIO_TIME_ZONE,
  }).format(new Date());
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

// Simulates the front-desk laptop reported in the bug: its OS clock/timezone
// is a US zone, unrelated to the studio's configured Europe/Amsterdam timezone.
test.use({ timezoneId: "America/Los_Angeles" });

test("the dashboard header shows the studio's timezone date, not the browser's, with zero console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);

  await expect(page.getByRole("heading", { name: "Today at the studio" })).toBeVisible();
  await expect(page.getByText(studioDayLabel())).toBeVisible();

  expect(errors).toEqual([]);
});
