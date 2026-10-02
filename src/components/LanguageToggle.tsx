import { setLocale, useI18n } from "../lib/i18n";

export function LanguageToggle() {
  const { locale, t } = useI18n();
  return (
    <button type="button" className="language-toggle" data-locale={locale}
      aria-label={t("切换到英文", "Switch to Chinese")}
      title={t("切换到英文", "Switch to Chinese")}
      onClick={() => setLocale(locale === "zh" ? "en" : "zh")}>
      <span lang="en" aria-hidden="true">EN</span>
      <span className="language-divider" aria-hidden="true">/</span>
      <span lang="zh-CN" aria-hidden="true">中</span>
    </button>
  );
}
