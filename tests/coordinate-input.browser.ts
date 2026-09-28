import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("boundary coordinate inputs select the annotated side in all embryo stages", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const baseUrl = process.env.ATLAS_TEST_URL ?? "http://127.0.0.1:5186";
  const screenshots = await mkdtemp(join(tmpdir(), "embryo-coordinates-"));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico"))
      errors.push(`${message.text()} ${message.location().url}`);
  });
  const axes = [
    { name: "AP", plane: "冠状面", zero: "-0.02" },
    { name: "DV", plane: "水平面", zero: "0.02" },
    { name: "ML", plane: "矢状面", zero: "-0.02" },
  ];
  const stages = [
    { id: "E11.5", slices: [2, 2, 34] },
    { id: "E13.5", slices: [3, 3, 34] },
    { id: "E15.5", slices: [2, 3, 47] },
    { id: "E18.5", slices: [2, 2, 57] },
  ];

  try {
    for (const stage of stages) {
      await page.goto(`${baseUrl}/embryo?stage=${stage.id}`);
      await expect(page.getByRole("spinbutton", { name: "AP 坐标，毫米" })).toBeEnabled();
      await expect(page.locator(".coordinate-title")).toContainText("标注边界相对坐标");
      await expect(page.locator("#embryo-coordinate-help")).toContainText("正中线未校准");
      await expect(page.locator(".slice-midline")).toHaveCount(0);

      for (const [i, axis] of axes.entries()) {
        const field = page.getByRole("spinbutton", { name: `${axis.name} 坐标，毫米` });
        const slider = page.getByRole("slider", { name: new RegExp(`${axis.plane}深度`) });
        await expect(field).toHaveAttribute("aria-describedby", "embryo-coordinate-help");
        for (let repeat = 0; repeat < 2; repeat++) {
          await field.fill("0");
          await field.press(repeat === 0 ? "Enter" : "Tab");
          await expect(field).toHaveValue(axis.zero);
          await expect(slider).toHaveValue(String(stage.slices[i]));
          await expect(slider).toHaveAttribute("aria-valuetext", new RegExp(`${axis.zero} 毫米`));
        }
        await field.fill("");
        await field.press("Tab");
        await expect(field).toHaveValue(axis.zero);
        await field.fill("0.8");
        await field.press("Escape");
        await field.press("Tab");
        await expect(field).toHaveValue(axis.zero);

        await page.getByRole("button", { name: `放大查看${axis.plane}` }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("slider", { name: new RegExp(`${axis.plane}深度`) })).toHaveValue(String(stage.slices[i]));
        await expect(dialog.locator(".slice-region-directory summary")).not.toContainText("· 0 个");
        await expect(dialog.locator(".slice-midline")).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
      }
    }

    const ap = page.getByRole("spinbutton", { name: "AP 坐标，毫米" });
    for (const [input, expected] of [["-0.001", "-0.02"], ["0.001", "0.02"]]) {
      await ap.fill(input);
      await ap.press("Enter");
      await expect(ap).toHaveValue(expected);
    }
    for (const [input, limit] of [["-1000", "min"], ["1000", "max"]]) {
      const expected = Number(await ap.getAttribute(limit)).toFixed(2);
      await ap.fill(input);
      await ap.press("Enter");
      await expect(ap).toHaveValue(expected);
    }
    await ap.fill("0");
    await ap.press("Enter");

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator("#embryo-coordinate-help").scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await expect(ap).toBeVisible();
      await expect(page.locator("#embryo-coordinate-help")).toBeVisible();
      const accessibility = await new AxeBuilder({ page })
        .include(".coordinate-bar")
        .include("#embryo-coordinate-help")
        .analyze();
      assert.deepEqual(accessibility.violations, []);
      await page.screenshot({ path: join(screenshots, `${width}.png`) });
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(baseUrl);
    await expect(page.getByRole("spinbutton", { name: "AP 坐标，毫米" })).toBeEnabled();
    for (const axis of axes) {
      const field = page.getByRole("spinbutton", { name: `${axis.name} 坐标，毫米` });
      await field.fill("0");
      await field.press("Enter");
      await expect(field).toHaveValue("0.00");
    }
    await expect(page.locator(".slice-midline")).toHaveCount(2);
    await expect(page.locator("#embryo-coordinate-help")).toHaveCount(0);
    assert.deepEqual(errors, []);
    console.log(`Coordinate browser screenshots: ${screenshots}`);
  } finally {
    await browser.close();
  }
});
