import { test as setup } from "@playwright/test";
import { STORAGE_STATE, signIn } from "./auth";

// Setup project (a dependency of the `chromium` project): sign in once and
// persist the session, so journey specs load it via storageState instead of
// logging in per test — fewer navigations, less flake.
setup("authenticate operator", async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
