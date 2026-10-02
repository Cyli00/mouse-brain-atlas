import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./studio.css";
import "./theme.css";
import "./mobile.css";
import { applyTheme, storedTheme } from "./lib/theme";
import { applyLocale, storedLocale } from "./lib/i18n";
applyTheme(storedTheme());
applyLocale(storedLocale());
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
