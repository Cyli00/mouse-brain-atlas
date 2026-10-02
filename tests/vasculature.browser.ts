import { atlasUrl as base, launchBrowser, collectPageErrors } from "./helpers/browser";
import assert from "node:assert/strict";
import test from "node:test";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { BoxGeometry } from "three";

test("vascular network loads lazily, filters, rotates, survives themes, and stays exclusive to adults", async () => {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1512, height: 1100 } });
  const page = await context.newPage();
  const screenshots = await mkdtemp(join(tmpdir(), "vascular-browser-"));
  const errors = collectPageErrors(page);
  let requests = 0;
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
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "14");
    await expect(page.locator(".vascular-load-status")).toContainText("14 项血管结构");
    assert.notDeepEqual(await canvas.screenshot(), initial);
    assert.equal(requests, 15, "one manifest and fourteen vessel meshes");
    const filter = page.getByRole("combobox", { name: "血管类别" });
    await filter.focus();
    await expect(filter).toBeFocused();
    await filter.press("Space");
    await filter.press("Escape");
    for (const [group, count] of [["sinus", "5"], ["artery", "5"], ["vein", "4"]]) {
      await filter.selectOption(group);
      await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-filter", group);
      await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", count);
      await expect(page.locator(".vascular-load-status")).toContainText(`${count} 项血管结构`);
    }
    await filter.selectOption("all");
    assert.equal(requests, 15);
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
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "14");
    await page.screenshot({ path: join(screenshots, "adult-dark.png") });
    await page.locator(".vascular-source summary").click();
    await expect(page.locator(".vascular-name-list li")).toHaveCount(14);
    await expect(page.locator(".vascular-source")).toContainText("MICe 血管图谱");
    await expect(page.locator(".vascular-source")).toContainText("未包含完整的脑膜细小血管及桥静脉");
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
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "0");
    await toggle.check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "14");
    await filter.selectOption("vein");
    assert.equal(requests, 15, "cached data must survive toggling");
    await page.getByRole("button", { name: "恢复显示" }).click();
    await expect(toggle).not.toBeChecked();
    await expect(page.locator(".vascular-filter select")).toHaveValue("all");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "0");
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
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    let fail = true;
    await page.route("**/vasculature/mice/meshes/*.bin.gz", (route) => fail
      ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
    await page.goto(base);
    const toggle = page.getByRole("checkbox", { name: "血管网络", exact: true });
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    await toggle.check();
    await expect(page.locator(".vascular-error")).toContainText("503");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "0");
    fail = false;
    await page.getByRole("button", { name: "重试血管" }).click();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "14");
    await expect(page.locator(".vascular-error")).toHaveCount(0);
    await page.reload();
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    await page.route("**/vasculature/mice/manifest.json", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue().catch(() => {});
    });
    await toggle.check();
    await expect(page.locator(".vascular-load-status")).toContainText("正在载入");
    await toggle.uncheck();
    await page.waitForTimeout(700);
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "0");
    await expect(page.locator(".vascular-error")).toHaveCount(0);
    await toggle.check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "14");
  } finally { await browser.close(); }
});

test("upper vascular clipping follows DV, clips crossing meshes, and preserves other scene layers", async () => {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1512, height: 1100 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const screenshots = await mkdtemp(join(tmpdir(), "vascular-clipping-"));
  let requests = 0;
  const errors = collectPageErrors(page);
  try {
    const fixtures = [
      { center: [6000, 2000, 5500], size: [80, 80, 3000] },
      { center: [6000, 6000, 5500], size: [80, 80, 3000] },
      { center: [6000, 4000, 7500], size: [80, 6000, 80] },
    ].map(({ center, size }, index) => {
      const geometry = new BoxGeometry(size[0], size[1], size[2]);
      geometry.translate(center[0], center[1], center[2]);
      const positions = geometry.getAttribute("position").array;
      const indices = Uint32Array.from(geometry.getIndex()!.array);
      const bytes = Buffer.alloc(8 + positions.byteLength + indices.byteLength);
      bytes.writeUInt32LE(positions.length / 3, 0);
      bytes.writeUInt32LE(indices.length / 3, 4);
      Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength).copy(bytes, 8);
      Buffer.from(indices.buffer).copy(bytes, 8 + positions.byteLength);
      geometry.dispose();
      return {
        entry: { id: index + 1, name: `裁切测试动脉 ${index + 1}`, group: "artery", url: `/vasculature/mice/meshes/${index + 1}.bin.gz`, vertexCount: positions.length / 3, triangleCount: indices.length / 3 },
        body: gzipSync(bytes),
      };
    });
    await page.route("**/vasculature/mice/manifest.json", (route) => {
      requests++;
      return route.fulfill({ json: { version: 1, stage: "adult", coordinateSpace: "Allen CCFv3 2017", units: "um", axisOrder: ["AP", "DV", "ML"], vessels: fixtures.map((fixture) => fixture.entry) } });
    });
    await page.route("**/vasculature/mice/meshes/*.bin.gz", (route) => {
      requests++;
      const fixture = fixtures.find(({ entry }) => route.request().url().endsWith(entry.url))!;
      return route.fulfill({ contentType: "application/octet-stream", body: fixture.body });
    });
    await page.goto(base);
    const above = page.getByRole("checkbox", { name: "仅显示交点水平面以上的血管" });
    const toggle = page.getByRole("checkbox", { name: "血管网络", exact: true });
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    await expect(above).not.toBeChecked();
    await expect(above).toBeDisabled();
    await expect(page.locator(".atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
    await toggle.check();
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "3");
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
    const filter = page.getByRole("combobox", { name: "血管类别" });
    await filter.selectOption("sinus");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "0");
    await expect(page.locator(".vascular-load-status")).toContainText("当前类别无具名血管");
    await filter.selectOption("artery");
    await expect(page.locator(".three-host")).toHaveAttribute("data-vascular-vessels", "3");
    const coordinates = await page.locator(".axis-legend").innerText();
    const url = page.url();
    await above.check();
    const partial = await shot();
    const partialCount = await vesselPixels(partial);
    assert.ok(partialCount > fullCount * 0.35 && partialCount < fullCount * 0.65,
      `crossing mesh must retain only its upper part: ${partialCount}/${fullCount}`);
    await expect(page.locator(".vascular-load-status")).toContainText("3 项血管结构 · 裁切前");
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
    assert.equal(requests, 4, "filter changes must not refetch the manifest or three meshes");
    await page.getByRole("button", { name: "恢复显示" }).click();
    await expect(above).not.toBeChecked(); await expect(above).toBeDisabled();
    assert.deepEqual(errors, []);
    console.log(`Vascular clipping screenshots: ${screenshots}`);
  } finally { await browser.close(); }
});
