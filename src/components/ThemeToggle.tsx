import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, saveTheme, storedTheme, THEME_STORAGE_KEY } from "../lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState(storedTheme);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const next = storedTheme();
      applyTheme(next);
      setTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const label = theme === "dark" ? "切换到日间模式" : "切换到夜间模式";
  return (
    <button type="button" className="theme-toggle" aria-label={label} title={label}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        saveTheme(next);
        setTheme(next);
      }}>
      {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
