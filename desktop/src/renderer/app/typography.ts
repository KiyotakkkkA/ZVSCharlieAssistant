export const TYPOGRAPHY_STORAGE_KEY = "zvs.assistant.typography";

export type FontSizeMode = "small" | "normal" | "large" | "huge";

export interface TypographySettings {
  fontFamily: string;
  size: FontSizeMode;
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontFamily: "",
  size: "normal",
};

const ROOT_FONT_SIZES: Record<FontSizeMode, string> = {
  small: "87.5%",
  normal: "100%",
  large: "112.5%",
  huge: "125%",
};

export function loadTypographyFromStorage(): TypographySettings {
  const raw = localStorage.getItem(TYPOGRAPHY_STORAGE_KEY);
  if (!raw) return DEFAULT_TYPOGRAPHY;
  try {
    const value = JSON.parse(raw) as Partial<TypographySettings>;
    return {
      fontFamily:
        typeof value.fontFamily === "string" ? value.fontFamily : "",
      size:
        value.size && value.size in ROOT_FONT_SIZES
          ? value.size
          : DEFAULT_TYPOGRAPHY.size,
    };
  } catch {
    return DEFAULT_TYPOGRAPHY;
  }
}

export function saveTypographyToStorage(settings: TypographySettings) {
  localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(settings));
}

export function applyTypographyToDocument(settings: TypographySettings) {
  const root = document.documentElement;
  const family = settings.fontFamily.trim();
  root.style.setProperty(
    "--font-sans",
    family
      ? `${JSON.stringify(family)}, "Onest Variable", "Segoe UI", sans-serif`
      : '"Onest Variable", "Segoe UI", sans-serif',
  );
  root.style.fontSize = ROOT_FONT_SIZES[settings.size];
}
