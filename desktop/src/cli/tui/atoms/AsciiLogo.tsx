import { Text } from "ink";
import { tuiColors } from "../theme";

const ZVS_LOGO = [
  "███████╗██╗   ██╗███████╗",
  "╚══███╔╝██║   ██║██╔════╝",
  "  ███╔╝ ██║   ██║███████╗",
  " ███╔╝  ╚██╗ ██╔╝╚════██║",
  "███████╗ ╚████╔╝ ███████║",
  "╚══════╝  ╚═══╝  ╚══════╝",
] as const;

/** Ширина ASCII-логотипа в колонках — по ней решается, влезает ли он на экран. */
export const LOGO_COLUMNS = Math.max(...ZVS_LOGO.map((line) => line.length));

export function AsciiLogo() {
  return (
    <Text bold color={tuiColors.accent} wrap="truncate-end">
      {ZVS_LOGO.join("\n")}
    </Text>
  );
}
