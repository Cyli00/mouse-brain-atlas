import { atlasUrl as base, launchBrowser, collectPageErrors } from "./helpers/browser";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("night mode preserves the scene, persists across pages, and keeps header controls aligned", async () => {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  const screenshots = await mkdtemp(join(tmpdir(), "atlas-night-"));
  const errors = collectPageErrors(page);
  try {
    await page.goto(base);
    await expect(page.locator(".three-host canvas")).toBeVisible();
    await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator(".mesh-status")).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const canvas = page.locator(".three-host canvas");
    const originalCanvas = await canvas.elementHandle();
    const imageHash = async () => createHash("sha256")
      .update(await canvas.screenshot({ animations: "disabled" })).digest("hex");
    const originalImage = await imageHash();
    const originalUrl = page.url();
    const values = await page.getByRole("spinbutton").evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
    await page.getByRole("button", { name: "切换到夜间模式" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    assert.equal(await canvas.evaluate((element, original) => element === original, originalCanvas), true);
    assert.notEqual(await imageHash(), originalImage, "WebGL background must change");
    assert.equal(page.url(), originalUrl);
    assert.deepEqual(await page.getByRole("spinbutton").evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value)), values);
    await page.getByRole("button", { name: "切换到日间模式" }).click();
    assert.equal(await imageHash(), originalImage, "theme round-trip must preserve camera and anatomical colors");
    await page.getByRole("button", { name: "切换到夜间模式" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    for (const route of ["/", "/embryo?stage=E11.5"]) {
      await page.goto(base + route);
      await expect(page.getByRole("spinbutton", { name: "AP 坐标，毫米" })).toBeEnabled();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const link = (await page.locator(".header-actions .source-link").boundingBox())!;
        const button = (await page.locator(".theme-toggle").boundingBox())!;
        assert.ok(button.x >= link.x + link.width, "theme control must be right of the source link");
        assert.ok(Math.abs(button.y + button.height / 2 - link.y - link.height / 2) < 1, "source link and toggle must share their vertical center");
        assert.ok(await page.locator(".masthead").evaluate((element) => element.scrollWidth <= element.clientWidth));
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole("button", { name: "脑区详情", exact: true }).click();
      await page.screenshot({ path: join(screenshots, route === "/" ? "adult.png" : "embryo.png"), animations: "disabled" });
      const accessibility = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(accessibility.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), []);
    }
    const otherPage = await context.newPage();
    await otherPage.goto(base);
    await otherPage.getByRole("button", { name: "切换到日间模式" }).click();
    await expect(page.getByRole("button", { name: "切换到夜间模式" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    assert.deepEqual(errors, []);
    console.log(`Night-mode screenshots: ${screenshots}`);
  } finally { await browser.close(); }
});

test("theme switching still works when persistent storage is unavailable", async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
    });
    await page.goto(base);
    await page.getByRole("button", { name: "切换到夜间模式" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "切换到日间模式" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  } finally { await browser.close(); }
});
