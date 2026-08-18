import { type StyleThemePalette } from "@kiyotakkkka/zvs-uikit-lib";

export const THEME_STORAGE_KEY = "zvs.assistant.theme";

type ThemePreset = {
  value: string;
  label: string;
  palette: StyleThemePalette;
};

const MAIN_STEPS = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
] as const;

const SEMANTIC_KEYS = [
  "accent",
  "danger",
  "warning",
  "success",
  "info",
] as const;
const SEMANTIC_STEPS = ["light", "medium", "dark"] as const;

export function findPresetByPalette(
  presets: ThemePreset[],
  palette: StyleThemePalette,
): ThemePreset | null {
  return (
    presets.find((preset) => arePalettesEqual(preset.palette, palette)) ?? null
  );
}

export function saveThemePaletteToStorage(palette: StyleThemePalette) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(palette));
}

export function loadThemePaletteFromStorage(): StyleThemePalette | null {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isStyleThemePalette(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function applyThemePaletteToDocument(palette: StyleThemePalette) {
  const root = document.documentElement;

  MAIN_STEPS.forEach((step) => {
    root.style.setProperty(`--color-main-${step}`, palette.main[step]);
  });

  SEMANTIC_KEYS.forEach((key) => {
    SEMANTIC_STEPS.forEach((step) => {
      root.style.setProperty(`--color-${key}-${step}`, palette[key][step]);
    });
  });
}

function arePalettesEqual(left: StyleThemePalette, right: StyleThemePalette) {
  const sameMain = MAIN_STEPS.every(
    (step) => left.main[step] === right.main[step],
  );
  if (!sameMain) return false;

  return SEMANTIC_KEYS.every((key) =>
    SEMANTIC_STEPS.every((step) => left[key][step] === right[key][step]),
  );
}

function isStyleThemePalette(value: unknown): value is StyleThemePalette {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StyleThemePalette>;

  if (!candidate.main || typeof candidate.main !== "object") return false;
  if (!MAIN_STEPS.every((step) => typeof candidate.main?.[step] === "string"))
    return false;

  return SEMANTIC_KEYS.every((key) => {
    const palette = candidate[key];
    return (
      typeof palette === "object" &&
      palette !== null &&
      SEMANTIC_STEPS.every((step) => typeof palette[step] === "string")
    );
  });
}
