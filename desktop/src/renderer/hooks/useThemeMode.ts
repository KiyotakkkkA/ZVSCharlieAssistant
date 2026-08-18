import { useEffect, useState } from "react";
import { resolveThemeModeFromDocument, type ThemeMode } from "../app/theme";

export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(() => syncThemeMode());

  useEffect(() => {
    const update = () => setMode(syncThemeMode());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme"],
    });
    update();
    return () => observer.disconnect();
  }, []);

  return mode;
}

function syncThemeMode(): ThemeMode {
  const mode = resolveThemeModeFromDocument();
  const root = document.documentElement;
  if (root.dataset.theme !== mode) root.dataset.theme = mode;
  return mode;
}

export function readCssColor(variable: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
}
