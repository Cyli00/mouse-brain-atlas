import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { LOCALE_STORAGE_KEY, setLocale, storedLocale, translateText } from "../src/lib/i18n";

test("scientific content and all packaged vessel names have complete English translations", async () => {
  const strings = new Set<string>();
  for (const path of ["regions", "cortical-regions", "embryo", "circuits", "white-matter"]) {
    const source = await readFile(new URL(`../src/data/${path}.ts`, import.meta.url), "utf8");
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /[\u3400-\u9fff]/.test(node.text)) strings.add(node.text);
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  const manifest = JSON.parse(await readFile(new URL("../public/vasculature/mice/manifest.json", import.meta.url), "utf8"));
  for (const vessel of manifest.vessels) strings.add(vessel.name);
  const missing = [...strings].filter((value) => !translateText(value, "en") || /[\u3400-\u9fff]/.test(translateText(value, "en")));
  assert.deepEqual(missing, []);
  for (const value of strings) assert.equal(translateText(value, "zh"), value);
});

test("progress, HTTP failures, fallback labels and non-message strings retain their meaning", () => {
  assert.match(translateText("正在载入 40 μm 参考体积与脑区标注…", "en"), /40 μm/);
  assert.equal(translateText("数据读取失败 (503)", "en"), "Could not read data (503)");
  assert.match(translateText("胚胎小鼠脑图谱 · E13.5", "en"), /Embryonic.*E13\.5/);
  assert.equal(translateText("CA1", "en"), "CA1");
  assert.equal(translateText("constructor", "en"), "constructor");
});

test("locale storage defaults safely and does not block switching when unavailable", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
    assert.equal(storedLocale(), "zh");
    values.set(LOCALE_STORAGE_KEY, "unexpected");
    assert.equal(storedLocale(), "zh");
    setLocale("en");
    assert.equal(storedLocale(), "en");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
    assert.equal(storedLocale(), "zh");
    assert.doesNotThrow(() => setLocale("zh"));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
