import { Box, Text } from "ink";
import type { TranscriptEntry } from "../state";
import { tuiColors } from "../theme";
import { RichContent } from "./RichContent";

export function ContentBlock({ entry }: { entry: TranscriptEntry }) {
  if (entry.kind === "user")
    return (
      <Box marginTop={1}>
        <Text bold color={tuiColors.accent}>
          ❯{" "}
        </Text>
        <RichContent content={entry.text} />
      </Box>
    );
  if (entry.kind === "tool") {
    const failed = entry.toolStatus === "failed";
    const running =
      entry.toolStatus === "requested" || entry.toolStatus === "running";
    return (
      <Box marginLeft={2}>
        <Text
          color={
            failed
              ? tuiColors.danger
              : running
                ? tuiColors.warning
                : tuiColors.cyan
          }
        >
          {failed ? "×" : running ? "◌" : "◆"} {entry.text}
        </Text>
      </Box>
    );
  }
  if (entry.kind === "reasoning")
    return (
      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Text color={tuiColors.muted}>◇ Размышления</Text>
        <RichContent content={entry.text} muted />
      </Box>
    );
  const config = {
    assistant: { title: "● Ответ", color: tuiColors.cyan, muted: false },
    system: { title: "Система", color: tuiColors.muted, muted: false },
    error: { title: "× Ошибка", color: tuiColors.danger, muted: false },
  }[entry.kind];
  return (
    <Box
      marginTop={1}
      borderStyle="round"
      borderColor={config.color}
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color={config.color}>
        {config.title}
      </Text>
      <RichContent content={entry.text} muted={config.muted} />
    </Box>
  );
}
