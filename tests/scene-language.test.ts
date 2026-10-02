import assert from "node:assert/strict";
import test from "node:test";
import { PLANES } from "../src/lib/atlas";
import { coordinateReference } from "../src/lib/coordinates";
import { SCENE_DIRECTIONS } from "../src/lib/scene-interaction";
import { ANATOMICAL_AXES } from "../src/lib/slice-interaction";
import { WHITE_MATTER_LABEL } from "../src/lib/white-matter";
import { CONNECTION_LABELS } from "../src/lib/circuit-interaction";
import { translateViewerText } from "../src/locales/viewer.en";

test("viewer translations cover shared anatomical directions and coordinate references", () => {
  const shared = [
    ...Object.values(PLANES).map((plane) => plane.name),
    ...Object.values(SCENE_DIRECTIONS).map((direction) => direction.label),
    ...ANATOMICAL_AXES.flatMap((axis) => [axis.name, axis.increasing]),
    ...Object.values(CONNECTION_LABELS),
    ...[0, 1, 2].flatMap((axis) => [
      coordinateReference(axis), coordinateReference(axis, 5400, 5700),
      coordinateReference(axis, 5400, 5700, true),
    ]),
    "向前", WHITE_MATTER_LABEL,
  ];
  for (const value of shared) {
    const translated = translateViewerText(value);
    assert.ok(translated, `Missing viewer translation: ${value}`);
    assert.doesNotMatch(translated, /\p{Script=Han}/u);
  }
});

test("loading and nested mesh errors retain progress and HTTP details in English", () => {
  assert.equal(translateViewerText("正在载入可选脑区 12 / 65"), "Loading available regions 12 / 65");
  assert.equal(translateViewerText("3 个脑区表面未能载入"), "3 region surfaces could not be loaded");
  assert.equal(translateViewerText("全脑表面加载失败：数据读取失败 (503)"),
    "Could not load the whole-brain surface: Could not read data (503)");
  assert.equal(translateViewerText("结构表面加载失败，请重试。三维网格索引无效"),
    "Could not load the structure surface. Please retry. The 3D mesh indices are invalid");
  assert.equal(translateViewerText("DV 切面位置"), "DV slice position");
  assert.equal(translateViewerText("Unrecognized source text"), undefined);
});
