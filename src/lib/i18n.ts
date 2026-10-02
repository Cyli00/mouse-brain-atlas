import { useMemo, useSyncExternalStore } from "react";
import { contentEnglish } from "../locales/content.en";
import { interfaceEnglish } from "../locales/interface.en";
import { viewerEnglish, translateViewerText } from "../locales/viewer.en";
import { whiteMatterEnglish } from "../locales/white-matter.en";

export type Locale = "zh" | "en";
export const LOCALE_STORAGE_KEY = "mouse-brain-atlas-locale";
const english = { ...contentEnglish, ...whiteMatterEnglish, ...viewerEnglish, ...interfaceEnglish };

export function storedLocale(): Locale {
  try { return localStorage.getItem(LOCALE_STORAGE_KEY) === "en" ? "en" : "zh"; }
  catch { return "zh"; }
}

let currentLocale = storedLocale();
const listeners = new Set<() => void>();

export function applyLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  document.querySelector('meta[name="description"]')?.setAttribute("content", locale === "en"
    ? "Explore a 3D mouse brain atlas built from Allen CCFv3 data, with linked coronal, sagittal and horizontal slices, region functions and original studies."
    : "基于 Allen CCFv3 真实数据的小鼠三维脑图谱，联动探索冠状面、矢状面与水平面，并查阅脑区功能与原始研究。");
}

function publish(locale: Locale) {
  applyLocale(locale);
  if (currentLocale === locale) return;
  currentLocale = locale;
  for (const listener of listeners) listener();
}

export function setLocale(locale: Locale) {
  publish(locale);
  try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); }
  catch { /* Language selection remains usable when storage is unavailable. */ }
}

function syncLocale(event: StorageEvent) {
  if (event.key === LOCALE_STORAGE_KEY || event.key === null) publish(storedLocale());
}

function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener("storage", syncLocale);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", syncLocale);
  };
}

export function translateText(value: string, locale: Locale): string {
  if (locale === "zh") return value;
  const exact = english[value];
  if (typeof exact === "string") return exact;
  const viewer = translateViewerText(value);
  if (typeof viewer === "string") return viewer;
  const embryoTitle = /^胚胎小鼠脑图谱 · (.+)$/.exec(value);
  if (embryoTitle) return `Embryonic mouse brain atlas · ${embryoTitle[1]}`;
  const unnamed = /^源数据未提供名称 · ID (\d+)$/.exec(value);
  if (unnamed) return `Name not provided by the source · ID ${unnamed[1]}`;
  return value;
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, () => currentLocale, () => "zh" as Locale);
  return useMemo(() => ({
    locale,
    t: (chinese: string, english: string) => locale === "en" ? english : chinese,
    text: (value: string) => translateText(value, locale),
    number: (value: number) => value.toLocaleString(locale === "en" ? "en-US" : "zh-CN"),
  }), [locale]);
}
