import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187";
async function ready(page: Page) {
  await expect(page.locator(".three-host canvas")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator(".mesh-status")).toHaveCount(0, { timeout: 30000 });
}
async function fits(page: Page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "page must not overflow horizontally");
  const cramped = await page.locator(".mobile-workspace-nav button, .scene-actions button, .slice-heading h3, .slice-heading-actions .mono, .scene-orientation button").evaluateAll((elements) => elements.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && el.scrollWidth > el.clientWidth + 1;
  }).map((el) => el.textContent));
  assert.deepEqual(cramped, [], "short labels and coordinates must fit their controls");
}

test("mobile modules remain readable and touch controls work at 320, 390 and 700 pixels", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  const screenshots = await mkdtemp(join(tmpdir(), "brain-mobile-"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const width of [320, 390, 700]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/embryo?stage=E13.5"]) {
        await page.goto(base + route); await ready(page);
        const prefix = `${width}-${route === "/" ? "adult" : "embryo"}`;
        await fits(page);
        const button = page.getByRole("button", { name: "选择观察方向" });
        const sceneBefore = (await page.locator(".three-host").boundingBox())!;
        await button.tap();
        await expect(page.getByRole("dialog", { name: "正对切面" })).toBeVisible();
        const popup = (await page.locator(".scene-orientation").boundingBox())!;
        assert.ok(popup.x >= 0 && popup.x + popup.width <= width);
        await page.getByRole("button", { name: "水平面，从背侧观察" }).tap();
        await page.getByRole("button", { name: "脑区详情", exact: true }).tap();
        const card = page.locator(".scene-region-card");
        await expect(card).toBeVisible();
        const sceneAfter = (await page.locator(".three-host").boundingBox())!;
        const cardBox = (await card.boundingBox())!;
        assert.equal(sceneBefore.height, sceneAfter.height, "details must not shrink the model");
        assert.ok(cardBox.y >= sceneAfter.y + sceneAfter.height, "details must not cover the canvas");
        assert.ok(await card.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), "details should use page scrolling");
        await page.locator(".viewer-panel").screenshot({ path: join(screenshots, `${prefix}-viewer.png`) });
        await page.getByRole("button", { name: "关闭脑区详情" }).tap();
        const cards = await page.locator(".slice-grid .slice-card").all();
        const boxes = await Promise.all(cards.map((c) => c.boundingBox()));
        assert.equal(boxes.length, 3);
        for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i]!.y >= boxes[i - 1]!.y + boxes[i - 1]!.height);
        await page.locator(".slices-section").screenshot({ path: join(screenshots, `${prefix}-slices.png`) });
        await page.locator(".coordinate-bar").screenshot({ path: join(screenshots, `${prefix}-coordinates.png`) });
        for (const name of ["AP", "DV", "ML"]) {
          const input = page.getByRole("spinbutton", { name: `${name} 坐标，毫米` });
          const box = (await input.boundingBox())!;
          assert.ok(box.height >= 44);
          assert.ok(await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize) >= 16));
        }
        await page.getByRole("button", { name: "放大查看冠状面" }).tap();
        await expect(page.getByRole("button", { name: "关闭放大切片" })).toBeVisible();
        await fits(page);
        await page.locator(".slice-dialog").screenshot({ path: join(screenshots, `${prefix}-dialog.png`) });
        await page.getByRole("button", { name: "关闭放大切片" }).tap();
        await page.getByRole("button", { name: "脑区导览", exact: true }).first().tap();
        await page.locator(".inspector-panel").screenshot({ path: join(screenshots, `${prefix}-catalog.png`) });
        await fits(page);
        await page.getByRole("button", { name: "解说与文献", exact: true }).first().tap();
        await page.locator(".inspector-panel").screenshot({ path: join(screenshots, `${prefix}-article.png`) });
        await fits(page);
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(base); await ready(page);
    await page.getByRole("checkbox", { name: "血管网络", exact: true }).check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "39214");
    await page.getByRole("checkbox", { name: "仅显示交点水平面以上的血管" }).check();
    await page.locator(".vascular-source summary").tap();
    await page.locator(".vascular-controls").screenshot({ path: join(screenshots, "vascular.png") });
    assert.ok(await page.locator(".vascular-source > div").evaluate((el) => getComputedStyle(el).position === "static"));
    await fits(page);
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id), []);
    await page.getByRole("button", { name: "脑区导览", exact: true }).first().tap();
    await page.getByRole("tab", { name: "经典环路" }).tap();
    await page.locator(".circuit-list > button").first().tap();
    await page.getByRole("button", { name: "解说与文献", exact: true }).first().tap();
    await page.locator(".inspector-panel").screenshot({ path: join(screenshots, "circuit.png") });
    await fits(page);
    await page.getByRole("button", { name: "切换到夜间模式" }).tap();
    await page.locator(".inspector-panel").screenshot({ path: join(screenshots, "circuit-dark.png") });
    assert.deepEqual(errors, []);
    console.log(`Mobile screenshots: ${screenshots}`);
  } finally { await browser.close(); }
});

test("touch scrolling a slice does not move its crosshair and expanded content remains reachable", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  try {
    await page.goto(base); await ready(page);
    const slice = page.locator(".slice-grid .slice-image").first();
    await slice.scrollIntoViewIfNeeded();
    const before = await page.getByRole("spinbutton").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
    const scrollBefore = await page.evaluate(() => scrollY);
    const box = (await slice.boundingBox())!;
    const x = box.x + box.width * .55, y = box.y + box.height * .65;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 6; i++)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 20, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore + 30);
    assert.deepEqual(await page.getByRole("spinbutton").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value)), before);
    await slice.tap({ position: { x: box.width * .3, y: box.height * .35 } });
    await expect.poll(() => page.getByRole("spinbutton").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value).join(","))).not.toBe(before.join(","));
    await page.getByRole("button", { name: "放大查看冠状面" }).tap();
    await page.locator(".slice-dialog .slice-region-directory > summary").tap();
    const footer = page.locator(".slice-dialog-footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
    await expect(page.getByRole("button", { name: "关闭放大切片" })).toBeInViewport();
    assert.ok(await page.locator(".slice-dialog").evaluate((el) => el.scrollTop > 0));
    await page.getByRole("button", { name: "关闭放大切片" }).tap();
    await expect(page.locator(".slice-dialog")).not.toBeVisible();
    await fits(page);
  } finally { await browser.close(); }
});
