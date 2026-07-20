---
name: playwright-e2e
description: Write, run, and debug Playwright end-to-end tests for Studiobook. Covers the fake-backends setup, selector strategy, the determinism hard-rules, the shared sign-in helper, and how e2e gates CI. Use whenever adding or fixing e2e tests or a user-journey check.
---

# Playwright E2E Testing (Studiobook)

E2E tests drive the real app in a browser against a production `next start`
server running in **fake-backends mode** — seeded in-memory repositories + a fake
email provider. There is no Supabase, Resend, Docker, or network: the suite is
self-contained and deterministic, which is exactly what a benchmark gate needs.

## Project setup

- **Config**: `apps/web/playwright.config.ts`
- **Specs**: `apps/web/e2e/*.spec.ts` (`smoke.spec.ts`, `journeys.spec.ts`)
- **Shared helpers**: `apps/web/e2e/support/` (`auth.ts` — `signIn`, `AUTHED_PATHS`)
- **Report / artifacts**: `playwright-report/` + `test-results/` (both gitignored)

The config boots the server itself:

```ts
webServer: {
  command: "pnpm run build && pnpm run start",   // production build, NOT `next dev`
  env: { USE_FAKE_BACKENDS: "1", PORT: "3100" },  // in-memory repos + fake email
  reuseExistingServer: !process.env.CI,
  url: "http://localhost:3100",                    // health-checked before tests run
}
```

`retries: 2` and `workers: 1` in CI; single `chromium` project; `trace: on-first-retry`.

## Running

```bash
pnpm --filter @studiobook/web e2e                       # full suite (builds + starts + runs)
pnpm --filter @studiobook/web exec playwright test e2e/journeys.spec.ts   # one file
pnpm --filter @studiobook/web exec playwright test -g "book a member"     # by name
pnpm --filter @studiobook/web exec playwright show-report                 # open last report
pnpm --filter @studiobook/web exec playwright show-trace test-results/<dir>/trace.zip
```

First run on a machine: `pnpm --filter @studiobook/web exec playwright install chromium`.

## CI gate

`.github/workflows/ci.yml` runs a dedicated `e2e` job (install → `playwright install
--with-deps chromium` → `pnpm e2e` → upload report + traces). It is a separate job in
the CI workflow, so the pipeline's `check_suite` requires **both `verify` and `e2e`** to
pass. Treat e2e as a first-class gate: a red e2e blocks the PR.

## Authentication + seeded data

Sign in with the shared helper (a fake magic-link stub — valid only under fake
backends):

```ts
import { signIn } from "./support/auth";
await signIn(page); // fills operator@riverbank.studio, lands on /dashboard
```

The seed always schedules classes around "today" and provides members, class
types, bookings, and invoices for the `riverbank` studio. The seed is **fixed**, so
asserting a seeded value (a member name, a class type) is stable — but still prefer
structural selectors (below) and reset nothing: the in-memory store re-seeds on each
server boot, and state persists across tests within a run, so keep tests
order-independent.

## Writing tests

```ts
import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

test.describe("feature", () => {
  test.beforeEach(async ({ page }) => { await signIn(page); });

  test("does one thing", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page.getByRole("form", { name: "New booking" })).toBeVisible();
  });
});
```

### Selector strategy (priority order)

1. **`getByRole`** — semantic + accessible; preferred for interactive elements
   (`getByRole("button", { name: "Book" })`, `getByRole("form", { name: "New booking" })`).
2. **`getByLabel`** — form fields (`getByLabel("Member")`, `getByLabel("Email")`).
3. **`getByTestId`** — the app already exposes stable ids for the data surfaces:
   `today-classes`, `schedule`, `bookings`, `members-table`, `invoices-table`,
   `revenue-table`. Use these to scope, not to replace role selectors.

The forms carry accessible names via `aria-label`: `New booking`, `Add class`,
`Add member`, `New invoice`.

## Hard rules (determinism — a flaky gate corrupts benchmark results)

1. **No static timeouts — ever.** NEVER `page.waitForTimeout()` or any fixed delay.
   Wait for observable state: `expect(locator).toBeVisible()`, `page.waitForURL()`,
   `page.waitForResponse(predicate)`. For eventual state, poll with
   `await expect(async () => { ... }).toPass({ timeout })`. (Studiobook's fake store is
   synchronous, so Playwright's built-in auto-waiting is usually enough.)
2. **`.first()` with `toBeVisible()` when a locator can match many.** Playwright runs in
   strict mode — a locator used with `toBeVisible()` must resolve to exactly one element.
   `page.getByRole("heading").first()`.
3. **Prefer structure over brittle copy.** Test functionality (navigation, form
   submission, URL), structural presence (`getByRole`, a testid table has rows), and
   accessibility — over exact prose. Assert seeded *data* only where it adds real value.
4. **Strict-mode substring traps.** `getByText("Total")` also matches "Subtotal"/"Total
   €X". Use `{ exact: true }` (and `.first()`) when the text is a substring of other text.
5. **Never skip.** No `test.skip()`, `.skip()`, `test.fixme()`, or commented-out tests to
   make CI green. If a test fails, fix the selector, the assertion, or the app — a genuine
   app bug is a bug to fix, not to skip. Only skip when the user explicitly asks.
6. **Journeys are happy-path regression checks.** They must stay green across tasks, so
   they exercise features the app already ships — not seeded-bug edge cases. Do not encode
   a task's expected fix into a journey.

## Debugging a failure

`trace: on-first-retry` captures a screenshot filmstrip, DOM snapshots, browser console
logs, and network activity for any test that fails then retries.

```bash
pnpm --filter @studiobook/web exec playwright show-trace test-results/<test-dir>/trace.zip
```

In CI the report + traces are uploaded as the `playwright-report` artifact. Note traces
capture **browser-side** logs only; server-side errors (Server Components, route handlers,
server actions) surface in the CI job's build/run log, not the trace.

Common patterns: **selector mismatch** (the element exists in the error-context snapshot
but the accessible name/role changed, or a strict-mode multi-match — narrow it or add
`{ exact: true }`); **timing** (a missing `waitFor` — never paper over with a static
delay); **client error** (a JS exception in the browser console — the app crashed on
render); **wrong route** (a protected page bounced to `/login` — the session wasn't held).
