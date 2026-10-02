import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { atlasUrl as base, collectPageErrors, launchBrowser, waitForScene } from "./helpers/browser";

async function expectEnglish(page: Page) {
  const leftovers = await page.evaluate(() => {
    const untranslated: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && !parent.closest(".language-toggle,script,style") && parent.checkVisibility({ checkVisibilityCSS: true }) && /[\u3400-\u9fff]/.test(node.textContent ?? "")) untranslated.push(node.textContent!.trim());
    }
    for (const element of document.querySelectorAll("[aria-label],[title],[placeholder],[aria-valuetext]")) {
      if (!element.checkVisibility({ checkVisibilityCSS: true })) continue;
      for (const attribute of ["aria-label", "title", "placeholder", "aria-valuetext"]) {
        const value = element.getAttribute(attribute);
        if (value && /[\u3400-\u9fff]/.test(value)) untranslated.push(`${attribute}: ${value}`);
      }
    }
    return untranslated;
  });
  assert.deepEqual(leftovers, [], "visible copy and accessible labels must follow English");
}

async function expectNoOverflow(page: Page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "the page must fit its viewport");
  assert.equal(await page.locator(".masthead").evaluate((element) => element.scrollWidth <= element.clientWidth), true, "header controls must fit");
}

test("language round-trip preserves loaded anatomy, coordinates, camera and filters", async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1512, height: 1100 }, reducedMotion: "reduce" });
  const errors = collectPageErrors(page);
  let dataRequests = 0;
  page.on("request", (request) => { if (/\/(data|vasculature)\/.*\.(json|gz)/.test(request.url())) dataRequests++; });
  try {
    await page.goto(base);
    await waitForScene(page);
    await page.getByRole("checkbox", { name: "血管网络", exact: true }).check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "14");
    await page.locator(".vascular-filter select").selectOption("sinus");
    const canvas = page.locator(".three-host canvas");
    const original = await canvas.elementHandle();
    const shot = async () => createHash("sha256").update(await canvas.screenshot({
      animations: "disabled",
      // A canvas element screenshot includes overlapping DOM labels. Compare
      // anatomy alone, since those labels are expected to change language.
      style: ".brain-scene > :not(.three-host) { visibility: hidden !important; }",
    })).digest("hex");
    const originalImage = await shot();
    const originalUrl = page.url();
    const values = await page.getByRole("spinbutton").evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
    const requestsBefore = dataRequests;
    await page.getByRole("button", { name: "切换到英文", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Adult mouse brain atlas");
    await expect(page).toHaveTitle(/Field CA1.*Adult mouse brain atlas/);
    assert.equal(await canvas.evaluate((element, before) => element === before, original), true);
    assert.equal(await shot(), originalImage, "language changes must preserve the rendered anatomy and camera");
    assert.equal(page.url(), originalUrl);
    assert.deepEqual(await page.getByRole("spinbutton").evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value)), values);
    assert.equal(dataRequests, requestsBefore, "language switching must not refetch atlas or vessel data");
    await expect(page.locator(".vascular-filter select")).toHaveValue("sinus");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "5");
    await page.locator(".vascular-source summary").click();
    await expect(page.locator(".vascular-name-list")).toContainText("Superior sagittal sinus");
    await expectEnglish(page);
    await page.locator(".vascular-source summary").click();
    await page.getByRole("button", { name: "Details & references", exact: true }).last().click();
    await expect(page.locator(".region-summary").last()).toContainText("CA1");
    await page.locator(".region-article > .evidence-disclosure > summary").click();
    await expectEnglish(page);
    await page.getByRole("button", { name: "Sources & methods", exact: true }).click();
    await expectEnglish(page);
    await page.getByRole("button", { name: "Switch to Chinese", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    assert.equal(await shot(), originalImage);
    assert.equal(dataRequests, requestsBefore);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("English persists across adult and embryonic pages, supports search and fits narrow layouts", async () => {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1512, height: 1100 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = collectPageErrors(page);
  const screenshots = await mkdtemp(join(tmpdir(), "atlas-language-"));
  try {
    await page.goto(base);
    await waitForScene(page);
    await page.getByRole("button", { name: "切换到英文", exact: true }).click();
    const search = page.locator(".search-field input");
    await search.fill("海马");
    await expect(page.locator(".guide-region-card").first()).toBeVisible();
    await expectEnglish(page);
    await search.fill("hippocampal");
    await expect(page.locator(".guide-region-card").first()).toBeVisible();
    await search.fill("no-such-region-123");
    await expectEnglish(page);
    await page.locator(".search-field button").click();
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    for (const route of ["/", "/embryo?stage=E11.5", "/embryo?stage=E13.5", "/embryo?stage=E15.5", "/embryo?stage=E18.5"]) {
      await page.goto(base + route);
      await expect(page.locator(".three-host canvas")).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole("spinbutton", { name: "AP coordinate, millimetres" })).toBeEnabled();
      await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
      await expectEnglish(page);
      for (const width of [1512, 390, 320]) {
        await page.setViewportSize({ width, height: 1100 });
        await expectNoOverflow(page);
        await expectEnglish(page);
      }
      if (route === "/" || route.includes("E13.5")) {
        await page.getByRole("button", { name: "Expand Coronal slice", exact: true }).click();
        await expect(page.locator("dialog")).toBeVisible();
        await expectEnglish(page);
        assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), []);
        await page.getByRole("button", { name: "Close expanded slice" }).click();
        await page.screenshot({ path: join(screenshots, route === "/" ? "adult-en-mobile.png" : "embryo-en-mobile.png"), fullPage: true, animations: "disabled" });
      }
      await page.setViewportSize({ width: 1512, height: 1100 });
    }
    const sibling = await context.newPage();
    await sibling.goto(base);
    await sibling.getByRole("button", { name: "Switch to Chinese" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("胚胎小鼠脑图谱");
    assert.deepEqual(errors, []);
    console.log(`Language screenshots: ${screenshots}`);
  } finally { await browser.close(); }
});

test("language switching works with blocked storage and translates loading failures and retry", async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
    });
    let fail = true;
    await page.route("**/data/manifest.json", (route) => fail ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
    await page.goto(base);
    await page.getByRole("button", { name: "切换到英文" }).click();
    await expect(page.getByRole("heading", { name: "Atlas could not be loaded" })).toBeVisible();
    await expectEnglish(page);
    fail = false;
    await page.getByRole("button", { name: "Reload data" }).click();
    await expect(page.locator(".three-host canvas")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("spinbutton", { name: "AP coordinate, millimetres" })).toBeEnabled();
    await page.getByRole("button", { name: "Switch to Chinese" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  } finally { await browser.close(); }
});

test("English covers PF white matter, circuit evidence and scene overlays", async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1512, height: 1100 }, reducedMotion: "reduce" });
  const errors = collectPageErrors(page);
  try {
    await page.goto(base);
    await waitForScene(page);
    await page.getByRole("button", { name: "切换到英文" }).click();
    await page.locator(".slice-source-field select").selectOption("paxinos-kim");
    await expect(page.locator(".catalog-load-state")).toHaveCount(0, { timeout: 30000 });
    await page.locator(".search-field input").fill("optic chiasm");
    await page.locator(".guide-region-card").first().click();
    await expect(page).toHaveURL(/region=-/);
    await expect(page.locator(".mesh-status")).toHaveCount(0, { timeout: 30000 });
    await page.locator(".inspector-navigation button").nth(1).click();
    await page.locator(".region-article > .evidence-disclosure > summary").click();
    await expectEnglish(page);
    await page.locator(".scene-help > summary").click();
    const help = page.locator(".scene-help-content");
    assert.equal(await help.evaluate((element) => element.scrollHeight > element.clientHeight), true, "long English help should be scrollable");
    await help.getByRole("button").scrollIntoViewIfNeeded();
    await help.getByRole("button").click();
    await expectEnglish(page);
    await page.keyboard.press("Escape");
    await page.locator(".scene-help > summary").click();
    await page.locator(".inspector-navigation button").first().click();
    await page.getByRole("tab", { name: "Circuits", exact: true }).click();
    await page.locator(".circuit-list button").first().click();
    await expect(page.locator(".circuit-article")).toBeVisible();
    await page.locator(".circuit-map-node").first().click();
    await page.locator(".circuit-path-directory summary").click();
    await page.locator(".circuit-article > .evidence-disclosure > summary").click();
    await expectEnglish(page);
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.getByRole("button", { name: "Details & references", exact: true }).first().click();
    await expectNoOverflow(page);
    await expectEnglish(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
