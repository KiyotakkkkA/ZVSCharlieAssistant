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

export function AsciiLogo() {
  return (
    <Text bold color={tuiColors.accent}>
      {ZVS_LOGO.join("\n")}
    </Text>
  );
}
