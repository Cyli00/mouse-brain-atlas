import { chromium, expect, type Page } from "@playwright/test";

export const atlasUrl = process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187";

export function launchBrowser() {
  return chromium.launch({ channel: process.env.BROWSER_CHANNEL });
}

export async function waitForScene(page: Page) {
  await expect(page.locator(".three-host canvas")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("spinbutton", { name: "AP 坐标，毫米" })).toBeEnabled();
  await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator(".mesh-status")).toHaveCount(0, { timeout: 30000 });
}

export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
