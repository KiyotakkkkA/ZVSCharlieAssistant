import { type StyleThemePalette } from "@kiyotakkkka/zvs-uikit-lib";

type ThemePreset = {
  value: string;
  label: string;
  palette: StyleThemePalette;
};

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
