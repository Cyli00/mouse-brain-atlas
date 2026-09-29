import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5187";
test("vascular network loads lazily, filters, rotates, survives themes, and stays exclusive to adults", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1100 } });
  const page = await context.newPage();
  const screenshots = await mkdtemp(join(tmpdir(), "vascular-browser-"));
  const errors: string[] = [];
  let requests = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (r.url().includes("/vasculature/")) requests++; });
  try {
    await page.goto(base);
    const toggle = page.getByRole("checkbox", { name: "血管网络", exact: true });
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
    assert.equal(requests, 0);
    const canvas = page.locator(".three-host canvas");
    const initial = await canvas.screenshot();
    await toggle.check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "39214");
    assert.notDeepEqual(await canvas.screenshot(), initial);
    assert.equal(requests, 2);
    const filter = page.getByRole("combobox", { name: "血管最小源直径" });
    await filter.focus();
    await expect(filter).toBeFocused();
    await filter.selectOption("60");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "13967");
    await filter.selectOption("36");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "154045");
    await filter.selectOption("48");
    assert.equal(requests, 2);
    const beforeRotation = await canvas.screenshot();
    await canvas.focus();
    await page.keyboard.press("ArrowLeft");
    assert.notDeepEqual(await canvas.screenshot(), beforeRotation);
    const url = page.url();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 75, box.y + box.height / 2 + 20, { steps: 12 });
    await page.mouse.up();
    assert.equal(page.url(), url);
    await page.getByRole("button", { name: "重置三维视角" }).click();
    await page.screenshot({ path: join(screenshots, "adult-light.png") });
    await canvas.evaluate((el) => el.setAttribute("data-preserved-canvas", "yes"));
    await page.getByRole("button", { name: "切换到夜间模式" }).click();
    await expect(canvas).toHaveAttribute("data-preserved-canvas", "yes");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "39214");
    await page.screenshot({ path: join(screenshots, "adult-dark.png") });
    await page.locator(".vascular-source summary").click();
    assert.deepEqual((await new AxeBuilder({ page }).include(".vascular-controls").analyze()).violations, []);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.getByRole("button", { name: "观察视图", exact: true }).click();
    await page.locator(".vascular-controls").scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(screenshots, "adult-mobile.png") });
    assert.deepEqual((await new AxeBuilder({ page }).include(".vascular-controls").analyze()).violations, []);
    await page.locator(".vascular-source summary").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(".vascular-source")).not.toHaveAttribute("open", "");
    await expect(page.locator(".vascular-source summary")).toBeFocused();
    await toggle.uncheck();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "0");
    await toggle.check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "39214");
    assert.equal(requests, 2, "cached data must survive toggling");
    await page.getByRole("button", { name: "恢复显示" }).click();
    await expect(toggle).not.toBeChecked();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "0");
    const beforeEmbryos = requests;
    for (const stage of ["E11.5", "E13.5", "E15.5", "E18.5"]) {
      await page.goto(`${base}/embryo?stage=${stage}`);
      await expect(page.locator(".three-host canvas")).toBeVisible({ timeout: 30000 });
      await expect(toggle).toHaveCount(0);
      await expect(page.locator(".vascular-controls")).toHaveCount(0);
      assert.equal(requests, beforeEmbryos, "embryos must not load adult vessels");
    }
    await page.screenshot({ path: join(screenshots, "embryo-unchanged.png") });
    assert.deepEqual(errors, []);
    console.log(`Vascular browser screenshots: ${screenshots}`);
  } finally { await browser.close(); }
});

test("vascular failure offers retry and cancelling a pending request leaves no overlay", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const page = await browser.newPage();
  try {
    let fail = true;
    await page.route("**/vasculature/adult/segments.float32.gz", (route) => fail
      ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
    await page.goto(base);
    const toggle = page.getByRole("checkbox", { name: "血管网络", exact: true });
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    await toggle.check();
    await expect(page.locator(".vascular-error")).toContainText("503");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "0");
    fail = false;
    await page.getByRole("button", { name: "重试血管" }).click();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "39214");
    await expect(page.locator(".vascular-error")).toHaveCount(0);
    await page.reload();
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    await page.route("**/vasculature/adult/manifest.json", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue().catch(() => {});
    });
    await toggle.check();
    await expect(page.locator(".vascular-load-status")).toContainText("正在载入");
    await toggle.uncheck();
    await page.waitForTimeout(700);
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "0");
    await expect(page.locator(".vascular-error")).toHaveCount(0);
    await toggle.check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "39214");
  } finally { await browser.close(); }
});

test("upper vascular clipping follows DV, clips crossing segments, and preserves other scene layers", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1512, height: 1100 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const screenshots = await mkdtemp(join(tmpdir(), "vascular-clipping-"));
  let requests = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const positions = new Float32Array([
      6000, 2000, 4000, 6000, 2000, 7000,
      6000, 6000, 4000, 6000, 6000, 7000,
      6000, 1000, 7500, 6000, 7000, 7500,
    ]);
    await page.route("**/vasculature/adult/manifest.json", (route) => {
      requests++;
      return route.fulfill({ json: { stage: "adult", coordinateSpace: "Allen CCFv3 2017", units: "um", axisOrder: ["AP", "DV", "ML"], countsByMinimumDiameterUm: { 36: 3, 48: 3, 60: 3 } } });
    });
    await page.route("**/vasculature/adult/segments.float32.gz", (route) => {
      requests++;
      return route.fulfill({ contentType: "application/octet-stream", body: Buffer.from(positions.buffer) });
    });
    await page.goto(base);
    const above = page.getByRole("checkbox", { name: "仅显示交点水平面以上的血管" });
    const toggle = page.getByRole("checkbox", { name: "血管网络", exact: true });
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    await expect(above).not.toBeChecked();
    await expect(above).toBeDisabled();
    await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
    await toggle.check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-segments", "3");
    const canvas = page.locator(".three-host canvas");
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + 10, box.y + 140, { button: "right" });
    await page.getByRole("button", { name: "冠状面，从头侧观察" }).click();
    const dv = page.getByRole("spinbutton", { name: "DV 坐标，毫米" });
    const setDV = async (value: string) => {
      await dv.fill(value); await dv.press("Enter");
      await expect(page.locator('.axis-legend [data-axis="DV"]')).toContainText(Number(value).toFixed(2));
    };
    const shot = async () => {
      await page.mouse.move(box.x + 5, box.y + 5);
      return canvas.screenshot({ mask: [page.locator(".axis-legend")] });
    };
    const vesselPixels = async (png: Buffer) => page.evaluate(async (base64) => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] > pixels[i + 1] + 35 && pixels[i] > pixels[i + 2] + 20) count++;
      return count;
    }, png.toString("base64"));
    await setDV("4");
    const full = await shot();
    const fullCount = await vesselPixels(full);
    assert.ok(fullCount > 100, "fixture vessels must actually render");
    const coordinates = await page.locator(".axis-legend").innerText();
    const url = page.url();
    await above.check();
    const partial = await shot();
    const partialCount = await vesselPixels(partial);
    assert.ok(partialCount > fullCount * 0.35 && partialCount < fullCount * 0.65,
      `crossing segment must retain only its upper part: ${partialCount}/${fullCount}`);
    assert.equal(await page.locator(".axis-legend").innerText(), coordinates);
    assert.equal(page.url(), url);
    await page.screenshot({ path: join(screenshots, "upper-half.png") });
    await setDV("0");
    assert.equal(await vesselPixels(await shot()), 0, "a plane above all vessels must hide them");
    await setDV("7.5");
    assert.ok((await shot()).equals(full), "a plane below all vessels must retain the whole network and other layers");
    await setDV("4");
    await above.uncheck();
    assert.ok((await shot()).equals(full), "disabling the filter must restore all vessels without changing the camera");
    await above.check();
    await toggle.uncheck();
    await expect(above).toBeChecked(); await expect(above).toBeDisabled();
    await toggle.check();
    assert.ok((await shot()).equals(partial), "toggling the vascular layer must preserve the filter");
    assert.equal(requests, 2, "filter changes must not refetch vascular data");
    await page.getByRole("button", { name: "恢复显示" }).click();
    await expect(above).not.toBeChecked(); await expect(above).toBeDisabled();
    assert.deepEqual(errors, []);
    console.log(`Vascular clipping screenshots: ${screenshots}`);
  } finally { await browser.close(); }
});
