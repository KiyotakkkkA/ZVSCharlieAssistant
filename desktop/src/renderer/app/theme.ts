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

export type ThemeMode = "light" | "dark";

export function resolveThemeMode(palette: StyleThemePalette): ThemeMode {
  return relativeLuminance(palette.main["900"]) > 0.5 ? "light" : "dark";
}

export function resolveThemeModeFromDocument(): ThemeMode {
  const background = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-main-900")
    .trim();
  if (!background) return "dark";
  return relativeLuminance(background) > 0.5 ? "light" : "dark";
}

function relativeLuminance(color: string): number {
  const [r, g, b] = parseColor(color);
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function parseColor(color: string): [number, number, number] {
  const value = color.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const digits = hex[1]!;
    const full =
      digits.length === 3
        ? digits
            .split("")
            .map((d) => d + d)
            .join("")
        : digits;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ];
  }

  const numbers = value.match(/\d+(\.\d+)?/g);
  if (numbers && numbers.length >= 3)
    return [Number(numbers[0]), Number(numbers[1]), Number(numbers[2])];

  return [0, 0, 0];
}

export function applyThemePaletteToDocument(palette: StyleThemePalette) {
  const root = document.documentElement;
  root.dataset.theme = resolveThemeMode(palette);

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
