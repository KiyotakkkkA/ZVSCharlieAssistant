import { type StyleThemePalette } from "@kiyotakkkka/zvs-uikit-lib";

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
