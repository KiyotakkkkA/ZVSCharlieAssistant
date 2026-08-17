import { type StyleThemePalette } from "@kiyotakkkka/zvs-uikit-lib";

export const THEME_STORAGE_KEY = "zvs.assistant.theme";

type ThemePreset = {
  value: string;
  label: string;
  palette: StyleThemePalette;
};

export const DARK_THEME_PRESETS: ThemePreset[] = [
  {
    value: "base",
    label: "ZVS Standard",
    palette: {
      main: {
        50: "#fafafa",
        100: "#f5f5f5",
        200: "#e5e5e5",
        300: "#d4d4d4",
        400: "#a3a3a3",
        500: "#737373",
        600: "#525252",
        700: "#404040",
        800: "#1c1c1c",
        900: "#0e0e0e",
      },
      accent: { light: "#d8ff8d", medium: "#b7f34a", dark: "#8fc52b" },
      danger: { light: "#fca5a5", medium: "#ef4444", dark: "#b91c1c" },
      warning: { light: "#fde68a", medium: "#f59e0b", dark: "#b45309" },
      success: { light: "#86efac", medium: "#22c55e", dark: "#15803d" },
      info: { light: "#93c5fd", medium: "#3b82f6", dark: "#1d4ed8" },
    },
  },
  {
    value: "monokai",
    label: "Monokai",
    palette: {
      main: {
        50: "#f8f8f2",
        100: "#f6f4cf",
        200: "#e6db74",
        300: "#a6e22e",
        400: "#66d9ef",
        500: "#f92672",
        600: "#fd971f",
        700: "#75715e",
        800: "#3e3d32",
        900: "#272822",
      },
      accent: { light: "#c4b5fd", medium: "#a78bfa", dark: "#7c3aed" },
      danger: { light: "#fda4af", medium: "#fb7185", dark: "#be123c" },
      warning: { light: "#fdba74", medium: "#fb923c", dark: "#c2410c" },
      success: { light: "#bef264", medium: "#84cc16", dark: "#4d7c0f" },
      info: { light: "#7dd3fc", medium: "#38bdf8", dark: "#0369a1" },
    },
  },
  {
    value: "gruvbox",
    label: "Gruvbox",
    palette: {
      main: {
        50: "#fbf1c7",
        100: "#ebdbb2",
        200: "#d5c4a1",
        300: "#bdae93",
        400: "#a89984",
        500: "#665c54",
        600: "#504945",
        700: "#3c3836",
        800: "#282828",
        900: "#1d2021",
      },
      accent: { light: "#fabd2f", medium: "#d79921", dark: "#b57614" },
      danger: { light: "#fb4934", medium: "#cc241d", dark: "#9d0006" },
      warning: { light: "#fe8019", medium: "#d65d0e", dark: "#af3a03" },
      success: { light: "#b8bb26", medium: "#98971a", dark: "#79740e" },
      info: { light: "#83a598", medium: "#458588", dark: "#076678" },
    },
  },
];

export const LIGHT_THEME_PRESETS: ThemePreset[] = [
  {
    value: "one-light",
    label: "One Light",
    palette: {
      main: {
        50: "#111827",
        100: "#1f2937",
        200: "#374151",
        300: "#4b5563",
        400: "#5f6b7c",
        500: "#6f7d91",
        600: "#a9b4c4",
        700: "#d7dee7",
        800: "#edf1f6",
        900: "#f8fafc",
      },
      accent: { light: "#4338ca", medium: "#6d28d9", dark: "#312e81" },
      danger: { light: "#991b1b", medium: "#dc2626", dark: "#7f1d1d" },
      warning: { light: "#854d0e", medium: "#d97706", dark: "#713f12" },
      success: { light: "#166534", medium: "#16a34a", dark: "#14532d" },
      info: { light: "#1e40af", medium: "#2563eb", dark: "#1e3a8a" },
    },
  },
  {
    value: "github-light",
    label: "GitHub Light",
    palette: {
      main: {
        50: "#24292f",
        100: "#424a53",
        200: "#57606a",
        300: "#6e7781",
        400: "#7d8590",
        500: "#8f98a3",
        600: "#c3cad3",
        700: "#e2e8ef",
        800: "#f6f8fa",
        900: "#ffffff",
      },
      accent: { light: "#0550ae", medium: "#0969da", dark: "#033d8b" },
      danger: { light: "#9a1c23", medium: "#cf222e", dark: "#7a0f16" },
      warning: { light: "#7a4e00", medium: "#bf8700", dark: "#5a3a00" },
      success: { light: "#0f5f2d", medium: "#1a7f37", dark: "#0f4d24" },
      info: { light: "#0550ae", medium: "#218bff", dark: "#033d8b" },
    },
  },
];

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

export function clearThemePaletteStorage() {
  localStorage.removeItem(THEME_STORAGE_KEY);
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
