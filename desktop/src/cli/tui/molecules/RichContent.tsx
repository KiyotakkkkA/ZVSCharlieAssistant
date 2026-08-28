import { Box, Text } from "ink";
import { InlineMarkup } from "../atoms/InlineMarkup";
import { tuiColors } from "../theme";

export function RichContent({
  content,
  muted = false,
}: {
  content: string;
  muted?: boolean;
}) {
  let inCode = false;
  return (
    <Box flexDirection="column">
      {content.split(/\r?\n/).map((line, index) => {
        if (line.trim().startsWith("```")) {
          inCode = !inCode;
          return (
            <Text key={index} color={tuiColors.muted}>
              {inCode ? "┌─ code" : "└────"}
            </Text>
          );
        }
        if (inCode)
          return (
            <Text key={index} color={tuiColors.text}>
              │ {line}
            </Text>
          );
        const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
        if (bullet)
          return (
            <Text key={index} color={muted ? tuiColors.muted : tuiColors.text}>
              {" "}
              • <InlineMarkup>{bullet[1] ?? ""}</InlineMarkup>
            </Text>
          );
        const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
        if (ordered)
          return (
            <Text key={index} color={muted ? tuiColors.muted : tuiColors.text}>
              {" "}
              {ordered[1]}. <InlineMarkup>{ordered[2] ?? ""}</InlineMarkup>
            </Text>
          );
        const heading = line.match(/^\s*#{1,3}\s+(.+)$/);
        if (heading)
          return (
            <Text key={index} bold color={tuiColors.text}>
              {heading[1]}
            </Text>
          );
        return (
          <Text key={index} color={muted ? tuiColors.muted : tuiColors.text}>
            <InlineMarkup>{line}</InlineMarkup>
          </Text>
        );
      })}
    </Box>
  );
}
