import assert from "node:assert/strict";
import test from "node:test";
import { expect } from "@playwright/test";
import { corticalRegionOutlines } from "../src/data/cortical-regions";
import { atlasUrl, collectPageErrors, launchBrowser, waitForScene } from "./helpers/browser";

test("expanded cortical models load and their source identities survive selection and language changes", async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1512, height: 1000 }, reducedMotion: "reduce" });
  const errors = collectPageErrors(page);
  const models = new Set<string>();
  page.on("response", (response) => {
    if (response.ok() && response.url().includes("/data/meshes/")) models.add(new URL(response.url()).pathname);
  });
  try {
    await page.goto(atlasUrl);
    await waitForScene(page);
    await expect(page.getByRole("button", { name: "大脑皮层 29", exact: true })).toBeVisible();
    for (const region of corticalRegionOutlines) assert.ok(models.has(`/data/meshes/${region.id}.bin.gz`), `missing ${region.acronym}`);
    for (const id of [993, 31, 714, 95, 254, 961, 502, 423]) {
      const region = corticalRegionOutlines.find((item) => item.id === id)!;
      await page.getByRole("searchbox").fill(region.acronym);
      await page.getByRole("button", { name: `${region.name} ${region.acronym}，定位并查看解说`, exact: true }).click();
      await waitForScene(page);
      assert.equal(new URL(page.url()).searchParams.get("region"), String(id));
      await expect(page.locator(".selected-copy strong")).toHaveText(region.name);
      await page.getByRole("button", { name: "解说与文献", exact: true }).last().click();
      await expect(page.locator(".region-function h3")).toHaveText("解剖定位");
      await page.getByRole("button", { name: "脑区导览", exact: true }).last().click();
    }
    await page.getByRole("button", { name: "切换到英文", exact: true }).click();
    await expect(page.locator(".selected-copy strong")).toHaveText("Field CA2");
    await page.getByRole("button", { name: "Details & references", exact: true }).last().click();
    await expect(page.locator(".region-function h3")).toHaveText("Anatomical context");
    await page.reload();
    await expect(page.locator(".mesh-status,.atlas-mesh-status")).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator(".selected-copy strong")).toHaveText("Field CA2");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("E11.5 ventricular cavities change the rendered surfaces without moving anatomy or inferring later-stage cavities", async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1512, height: 1100 }, reducedMotion: "reduce" });
  const errors = collectPageErrors(page);
  try {
    await page.goto(`${atlasUrl}/embryo?stage=E11.5`);
    await waitForScene(page);
    await expect(page.locator(".scene-caption")).toContainText("单侧为主 · 源标注不完整");
    const toggle = page.getByRole("checkbox", { name: "显示脑室腔", exact: true });
    await expect(toggle).not.toBeChecked();
    const canvas = page.locator(".three-host canvas");
    await canvas.click({ button: "right", position: { x: 150, y: 150 } });
    await page.getByRole("button", { name: "矢状面，从右侧观察", exact: true }).click();
    const shot = async () => {
      await page.mouse.move(0, 0);
      // Keep fractional canvas edges clear of viewport clipping when comparing pixels.
      await canvas.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 80, behavior: "instant" }));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return canvas.screenshot({ animations: "disabled", style: ".brain-scene > :not(.three-host) { visibility: hidden !important; } .three-host canvas { outline: none !important; }" });
    };
    const changedPixels = async (first: Buffer, second: Buffer) => page.evaluate(async (images) => {
      const pixels = await Promise.all(images.map(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      }));
      if (pixels[0].length !== pixels[1].length) return 1;
      let changed = 0;
      for (let i = 0; i < pixels[0].length; i += 4)
        if ([0, 1, 2].some((channel) => Math.abs(pixels[0][i + channel] - pixels[1][i + channel]) > 2)) changed++;
      return changed / (pixels[0].length / 4);
    }, [first, second].map((buffer) => `data:image/png;base64,${buffer.toString("base64")}`));
    const initial = await shot();
    const coordinates = await page.getByRole("spinbutton").evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    const cavityDifference = await changedPixels(await shot(), initial);
    assert.ok(cavityDifference > 0.005, `cavity visibility must change the actual WebGL render; changed ${cavityDifference}`);
    assert.deepEqual(await page.getByRole("spinbutton").evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value)), coordinates);
    await toggle.uncheck();
    const restored = await shot();
    const restoredDifference = await changedPixels(restored, initial);
    assert.ok(restoredDifference < 0.001, `hiding cavities must restore the tissue view; changed ${restoredDifference}`);
    await page.getByRole("searchbox").fill("v_F");
    await page.getByRole("button", { name: "前脑脑室腔 v_F，定位并查看解说", exact: true }).click();
    await waitForScene(page);
    await expect(toggle).not.toBeChecked();
    await expect(page.locator(".selected-copy strong")).toHaveText("前脑脑室腔");
    await page.getByRole("button", { name: "只看选区", exact: true }).click();
    const selectedCavity = await shot();
    await toggle.check();
    assert.ok(await changedPixels(await shot(), selectedCavity) < 0.001, "isolation must keep only the selected cavity visible");
    await page.getByRole("button", { name: "恢复显示", exact: true }).click();
    await expect(toggle).not.toBeChecked();
    assert.equal(new URL(page.url()).searchParams.get("region"), "126651562");
    await page.getByRole("button", { name: "切换到英文", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Show ventricular cavities", exact: true })).not.toBeChecked();
    await expect(page.locator(".selected-copy strong")).toHaveText("ventricles, forebrain");
    await page.setViewportSize({ width: 390, height: 1100 });
    await page.getByRole("button", { name: "3D view", exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole("checkbox", { name: "Show ventricular cavities", exact: true }).check();
    await page.goto(`${atlasUrl}/embryo?stage=E13.5`);
    await expect(page.locator(".three-host canvas")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("checkbox", { name: "Show ventricular cavities", exact: true })).toHaveCount(0);
    await expect(page.locator(".embryo-partition-note")).toContainText("no separate ventricular labels");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
