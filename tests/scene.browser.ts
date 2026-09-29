import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function ready(page: Page) {
  await expect(page.locator(".three-host canvas")).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "AP 坐标，毫米" })).toBeEnabled();
  await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator(".mesh-status")).toHaveCount(0, { timeout: 30000 });
}

async function findRegion(page: Page) {
  const box = (await page.locator(".three-host canvas").boundingBox())!;
  for (const y of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    for (const x of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const point = { x: box.x + box.width * x, y: box.y + box.height * y };
      await page.mouse.move(point.x, point.y);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      if (await page.locator(".scene-hover-label").isVisible())
        return { ...point, name: await page.locator(".scene-hover-label strong").innerText() };
    }
  }
  throw new Error("No selectable region was found on the rendered brain");
}

test("3D atlas supports real mesh picking, detail cards, rotation, pan, and isolation", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1000 } });
  const page = await context.newPage();
  const base = process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187";
  const screenshots = await mkdtemp(join(tmpdir(), "brain-studio-"));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico"))
      errors.push(`${message.text()} ${message.location().url}`);
  });
  try {
    for (const route of ["/", "/embryo?stage=E13.5"]) {
      await page.goto(base + route);
      await ready(page);
      const initialUrl = page.url();
      const hit = await findRegion(page);
      assert.equal(page.url(), initialUrl, "hover must not change selection");
      await page.mouse.click(hit.x, hit.y);
      await expect(page.locator(".scene-region-card h2")).toHaveText(hit.name);
      await expect(page.locator(".selected-copy strong")).toHaveText(hit.name);
      await expect(page.locator(".scene-region-summary")).not.toBeEmpty();
      await ready(page);
      const currentUrl = page.url();
      assert.match(currentUrl, /region=/);
      await page.screenshot({ path: join(screenshots, route === "/" ? "adult-detail.png" : "embryo-detail.png") });

      await page.getByRole("button", { name: "关闭脑区详情" }).click();
      const canvas = page.locator(".three-host canvas");
      const before = await canvas.screenshot();
      await page.mouse.move(hit.x, hit.y);
      await page.mouse.down();
      await page.mouse.move(hit.x + 90, hit.y + 30, { steps: 15 });
      await page.mouse.up();
      assert.equal(page.url(), currentUrl, "drag must not select another region");
      await expect(page.locator(".scene-region-card")).toHaveCount(0);
      assert.notDeepEqual(await canvas.screenshot(), before, "drag must rotate the rendered model");

      const beforePan = await canvas.screenshot();
      await page.keyboard.down("Control");
      await page.mouse.move(hit.x, hit.y);
      await page.mouse.down();
      await page.mouse.move(hit.x + 60, hit.y, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up("Control");
      assert.equal(page.url(), currentUrl);
      await expect(page.getByRole("dialog", { name: "正对切面" })).toHaveCount(0);
      assert.notDeepEqual(await canvas.screenshot(), beforePan, "Ctrl drag must pan the model");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await canvas.focus();
      await page.keyboard.press("ArrowLeft");
      const reducedMotionFrame = await canvas.screenshot();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.deepEqual(await canvas.screenshot(), reducedMotionFrame, "reduced motion must settle without inertial rotation");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.keyboard.press("Enter");
      await expect(page.locator(".scene-region-card")).toBeVisible();
      await page.getByRole("button", { name: "单独观察", exact: true }).click();
      await expect(page.getByRole("button", { name: "只看选区", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "关闭脑区详情" }).click();
      await page.getByRole("button", { name: "分区探索", exact: true }).click();
      await page.getByRole("button", { name: "重置三维视角" }).click();
      await expect(page.getByRole("button", { name: "分区探索", exact: true })).toHaveAttribute("aria-pressed", "true");
    }

    await page.goto(base);
    await ready(page);
    await page.getByRole("searchbox").fill("CA1");
    await page.getByRole("button", { name: /海马 CA1 区 CA1，定位/ }).click();
    await expect(page.locator(".scene-region-card")).toBeVisible();
    await page.getByRole("button", { name: "功能、证据与文献" }).click();
    await expect(page.locator(".region-article h2")).toHaveText("海马 CA1 区");
    await expect(page.locator(".scene-region-card")).toHaveCount(0);

    for (const width of [1512, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 390) await page.getByRole("button", { name: "观察视图", exact: true }).click();
      await page.locator(".viewer-panel").scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "脑区详情", exact: true }).click();
      await expect(page.locator(".scene-region-card")).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: join(screenshots, `studio-${width}.png`) });
      const result = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), []);
      await page.getByRole("button", { name: "关闭脑区详情" }).click();
    }
    assert.deepEqual(errors, []);
    console.log(`Studio browser screenshots: ${screenshots}`);
  } finally {
    await browser.close();
  }
});

test("a failed atlas surface can retry while other regions remain selectable", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    const manifest = JSON.parse(await readFile(new URL("../public/data/manifest.json", import.meta.url), "utf8"));
    const asset = manifest.regions.find((r: { id: number }) => r.id !== 382).mesh.url;
    let fail = true;
    await page.route(`**${asset}`, (route) => fail
      ? route.fulfill({ status: 503, body: "Surface temporarily unavailable" })
      : route.continue());
    await page.goto(process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187");
    await expect(page.locator(".atlas-mesh-status")).toContainText("未能", { timeout: 30000 });
    const hit = await findRegion(page);
    await page.mouse.click(hit.x, hit.y);
    await expect(page.locator(".scene-region-card h2")).toHaveText(hit.name);
    await page.getByRole("button", { name: "关闭脑区详情" }).click();
    fail = false;
    const recovered = page.waitForResponse((response) => response.url().endsWith(asset) && response.ok());
    await page.locator(".atlas-mesh-status").getByRole("button", { name: "重试" }).click();
    await recovered;
    await ready(page);
    await findRegion(page);
  } finally { await browser.close(); }
});

test("touch selects a brain region and circuit mode retains its own controls", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto(process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187");
    await ready(page);
    await page.locator(".viewer-panel").scrollIntoViewIfNeeded();
    const box = (await page.locator(".three-host canvas").boundingBox())!;
    for (const x of [0.5, 0.4, 0.6]) {
      await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * 0.5);
      if (await page.locator(".scene-region-card").isVisible()) break;
    }
    await expect(page.locator(".scene-region-card")).toBeVisible();
    await page.getByRole("button", { name: "关闭脑区详情" }).tap();
    await page.getByRole("button", { name: "脑区导览", exact: true }).first().tap();
    await page.getByRole("tab", { name: "经典环路" }).tap();
    await page.locator(".circuit-list > button").first().tap();
    await page.getByRole("button", { name: "观察视图", exact: true }).tap();
    await expect(page.locator(".scene-circuit-label")).toBeVisible();
    await expect(page.locator(".circuit-load-status")).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByRole("button", { name: "聚焦整个环路" })).toBeVisible();
    await expect(page.locator(".scene-region-card")).toHaveCount(0);
    await expect(page.locator(".scene-mode-switch")).toHaveCount(0);
  } finally { await browser.close(); }
});

test("free rotation, Shift slice arrows, and live coordinates work in adult and embryo viewers", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1000 }, reducedMotion: "reduce" });
  const screenshots = await mkdtemp(join(tmpdir(), "brain-slice-gizmo-"));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    for (const route of ["/", "/embryo?stage=E13.5"]) {
      await page.goto((process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187") + route);
      await ready(page);
      const canvas = page.locator(".three-host canvas");
      const box = (await canvas.boundingBox())!;
      const syncCoordinates = async () => {
        for (const axis of ["AP", "DV", "ML"]) {
          await expect.poll(async () => {
            const value = Number(await page.getByRole("spinbutton", { name: `${axis} 坐标，毫米` }).inputValue());
            return (await page.locator(`.axis-legend [data-axis=${axis}]`).innerText()) === `${axis} ${value.toFixed(2)}`;
          }).toBe(true);
        }
      };
      await syncCoordinates();
      for (let i = 0; i < 7; i++) {
        await page.mouse.move(box.x + 5, box.y + 5);
        const before = await canvas.screenshot();
        await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.3);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.75, { steps: 12 });
        await page.mouse.up();
        await page.mouse.move(box.x + 5, box.y + 5);
        assert.ok(!(await canvas.screenshot()).equals(before), `vertical rotation must continue on drag ${i}`);
      }
      await page.getByRole("button", { name: "重置三维视角" }).click();
      await page.mouse.move(box.x + 5, box.y + 5);
      const initial = await canvas.screenshot({ mask: [page.locator(".axis-legend")] });
      const url = page.url();
      await page.keyboard.down("Shift");
      await expect(page.locator(".slice-gizmo")).toBeVisible();
      const shown = await canvas.screenshot();
      await page.mouse.move(box.x + 8, box.y + 80);
      await page.mouse.down();
      await page.mouse.move(box.x + 48, box.y + 120, { steps: 8 });
      await page.mouse.up();
      assert.ok((await canvas.screenshot()).equals(shown), "Shift drag off an arrow must not pan or rotate");
      for (const axis of ["AP", "DV", "ML"]) {
        const before = await Promise.all(["AP", "DV", "ML"].map((a) => page.getByRole("spinbutton", { name: `${a} 坐标，毫米` }).inputValue()));
        const arrow = page.locator(`.slice-gizmo [data-axis=${axis}]`);
        const point = await arrow.evaluate((group) => {
          const circle = group.querySelector("circle")!;
          const rect = circle.getBoundingClientRect();
          const path = group.querySelector("path")!.getAttribute("d")!;
          const [x, y] = path.match(/^M([^,]+),([^ ]+)/)!.slice(1).map(Number);
          const dx = Number(circle.getAttribute("cx")) - x;
          const dy = Number(circle.getAttribute("cy")) - y;
          const length = Math.hypot(dx, dy);
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, dx: dx / length, dy: dy / length };
        });
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + point.dx * 25, point.y + point.dy * 25, { steps: 10 });
        await page.mouse.up();
        const after = await Promise.all(["AP", "DV", "ML"].map((a) => page.getByRole("spinbutton", { name: `${a} 坐标，毫米` }).inputValue()));
        ["AP", "DV", "ML"].forEach((a, i) => a === axis ? assert.notEqual(after[i], before[i], `${axis} arrow must move its slice`) : assert.equal(after[i], before[i], `${axis} must preserve ${a}`));
        await syncCoordinates();
      }
      await page.screenshot({ path: join(screenshots, route === "/" ? "adult-arrows.png" : "embryo-arrows.png") });
      await page.keyboard.up("Shift");
      await expect(page.locator(".slice-gizmo")).toBeHidden();
      assert.equal(page.url(), url, "slice drag must not select another brain region");
      assert.ok((await canvas.screenshot({ mask: [page.locator(".axis-legend")] })).equals(initial), "slice drag must preserve the camera and restore hidden planes");
      const input = page.getByRole("spinbutton", { name: "AP 坐标，毫米" });
      await input.fill("-1"); await input.press("Enter");
      await syncCoordinates();
    }
    assert.deepEqual(errors, []);
    console.log(`Slice gizmo screenshots: ${screenshots}`);
  } finally { await browser.close(); }
});

test("right-clicking anywhere in the viewer offers normal-to-slice views without moving slices", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const screenshots = await mkdtemp(join(tmpdir(), "brain-orientation-"));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187";
  try {
    for (const route of ["/", "/embryo?stage=E13.5"]) {
      await page.goto(base + route);
      await ready(page);
      const canvas = page.locator(".three-host canvas");
      const box = (await canvas.boundingBox())!;
      const coordinates = await page.locator(".axis-legend").innerText();
      const url = page.url();
      await expect(page.locator(".view-switch")).toHaveCount(0);
      let previousDirection: Buffer | undefined;
      for (const label of ["冠状面，从头侧观察", "冠状面，从尾侧观察", "矢状面，从左侧观察", "矢状面，从右侧观察", "水平面，从腹侧观察", "水平面，从背侧观察"]) {
        await page.mouse.click(box.x + 15, box.y + box.height * 0.45, { button: "right" });
        const popup = page.getByRole("dialog", { name: "正对切面" });
        await expect(popup).toBeVisible();
        await expect(popup.getByRole("button").first()).toBeFocused();
        await popup.getByRole("button", { name: label }).click();
        await expect(popup).toHaveCount(0);
        await page.mouse.move(box.x + 5, box.y + 5);
        const frame = await canvas.screenshot();
        if (previousDirection) assert.ok(!frame.equals(previousDirection), `${label} must change the viewing direction`);
        previousDirection = frame;
        await expect(canvas).toBeFocused();
        assert.equal(await page.locator(".axis-legend").innerText(), coordinates);
        assert.equal(page.url(), url);
      }
      await page.mouse.click(box.x + 15, box.y + box.height * 0.45, { button: "right" });
      await expect(page.getByRole("dialog", { name: "正对切面" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "正对切面" })).toHaveCount(0);
      await expect(canvas).toBeFocused();
      await page.getByRole("button", { name: "重置三维视角" }).click();
      const hit = await findRegion(page);
      const beforeRightClick = await page.locator(".axis-legend").innerText();
      await page.mouse.click(hit.x, hit.y, { button: "right" });
      await expect(page.getByRole("dialog", { name: "正对切面" })).toBeVisible();
      assert.equal(await page.locator(".axis-legend").innerText(), beforeRightClick);
      assert.equal(page.url(), url);
      await page.keyboard.press("Escape");
      await page.mouse.dblclick(box.x + 15, box.y + box.height * 0.45);
      await expect(page.getByRole("dialog", { name: "正对切面" })).toHaveCount(0);
      await expect(page.locator(".scene-instruction")).toContainText("右键正对切面 · 滚轮缩放");
      if (await page.locator(".scene-region-card").isVisible())
        await page.getByRole("button", { name: "关闭脑区详情" }).click();
      await page.locator(".scene-help summary").click();
      await page.getByRole("button", { name: "正对切面…", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "正对切面" })).toBeVisible();
      await page.keyboard.press("Escape");
      await page.locator(".scene-help summary").click();
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.getByRole("button", { name: "观察视图", exact: true }).click();
    await page.locator(".viewer-panel").scrollIntoViewIfNeeded();
    const box = (await page.locator(".three-host canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width - 12, box.y + box.height * 0.45, { button: "right" });
    const popup = page.getByRole("dialog", { name: "正对切面" });
    await expect(popup).toBeVisible();
    const popupBox = (await popup.boundingBox())!;
    assert.ok(popupBox.x >= 0 && popupBox.x + popupBox.width <= 390);
    await page.screenshot({ path: join(screenshots, "orientation-mobile.png") });
    const a11y = await new AxeBuilder({ page }).include(".scene-orientation").analyze();
    assert.deepEqual(a11y.violations.map((v) => v.id), []);
    await page.getByRole("button", { name: "水平面，从背侧观察" }).click();
    assert.deepEqual(errors, []);
    console.log(`Orientation screenshots: ${screenshots}`);
  } finally { await browser.close(); }
});

test("Control pans on macOS event paths without opening the orientation menu; Meta does not pan", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1000 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187");
    await ready(page);
    const canvas = page.locator(".three-host canvas");
    const box = (await canvas.boundingBox())!;
    const point = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.48 };
    const popup = page.getByRole("dialog", { name: "正对切面" });
    const coordinates = await page.locator(".axis-legend").innerText();
    const url = page.url();
    const align = async () => {
      await page.mouse.click(box.x + 10, box.y + 140, { button: "right" });
      await expect(popup).toBeVisible();
      await popup.getByRole("button", { name: "冠状面，从头侧观察" }).click();
      await expect(popup).toHaveCount(0);
      await page.mouse.move(box.x + 5, box.y + 5);
    };
    for (const button of ["left", "right"] as const) {
      await align();
      const before = await canvas.screenshot();
      await page.keyboard.down("Control");
      await page.mouse.move(point.x, point.y);
      await page.mouse.down({ button });
      // Some macOS context events omit ctrlKey; the held key must still suppress the menu.
      await canvas.dispatchEvent("contextmenu", { button: 2, ctrlKey: false, clientX: point.x, clientY: point.y });
      await expect(popup).toHaveCount(0);
      await page.mouse.move(point.x + 65, point.y + 25, { steps: 12 });
      await page.mouse.up({ button });
      await page.keyboard.up("Control");
      await expect(popup).toHaveCount(0);
      await page.mouse.move(box.x + 5, box.y + 5);
      const panned = await canvas.screenshot();
      assert.ok(!panned.equals(before), `Control + ${button} must move the model`);
      await align();
      assert.ok((await canvas.screenshot()).equals(panned), "panning must preserve camera orientation");
      assert.equal(await page.locator(".axis-legend").innerText(), coordinates);
      assert.equal(page.url(), url);
    }
    await page.keyboard.down("Meta");
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 65, point.y + 25, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up("Meta");
    await page.mouse.move(box.x + 5, box.y + 5);
    const rotated = await canvas.screenshot();
    await align();
    assert.ok(!(await canvas.screenshot()).equals(rotated), "Meta drag must rotate instead of pan");
    await page.keyboard.down("Control");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.keyboard.up("Control");
    await align();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
