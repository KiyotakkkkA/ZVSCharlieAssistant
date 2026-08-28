import { Box, Text } from "ink";
import type { TranscriptEntry } from "../state";
import { tuiColors } from "../theme";
import { Spinner } from "../atoms/Spinner";
import { RichContent } from "./RichContent";

export function ContentBlock({ entry }: { entry: TranscriptEntry }) {
  if (entry.kind === "user")
    return (
      <Box marginTop={1} flexDirection="column">
        <Box
          width="100%"
          paddingX={1}
          backgroundColor={tuiColors.panelSelected}
        >
          <Text
            bold
            color={tuiColors.text}
            backgroundColor={tuiColors.panelSelected}
          >
            ›{" "}
          </Text>
          <RichContent content={entry.text} />
        </Box>
        {entry.attachments?.map((attachment, index) => (
          <Box
            key={`${attachment.fileName}:${attachment.size}:${index}`}
            marginLeft={2}
            marginTop={index === 0 ? 1 : 0}
            paddingX={1}
          >
            <Text color={tuiColors.accent}>▣ </Text>
            <Text bold>{attachment.fileName}</Text>
            <Text color={tuiColors.muted}>
              {" "}· {attachmentType(attachment.fileName, attachment.mimeType)} ·{" "}
              {formatBytes(attachment.size)}
            </Text>
          </Box>
        ))}
      </Box>
    );
  if (entry.kind === "tool") {
    const failed = entry.toolStatus === "failed";
    const running =
      entry.toolStatus === "requested" || entry.toolStatus === "running";
    return (
      <Box marginLeft={1}>
        {running ? (
          <Spinner color={tuiColors.warning} />
        ) : (
          <Text color={failed ? tuiColors.danger : tuiColors.cyan}>
            {failed ? "×" : "●"}
          </Text>
        )}
        <Text
          color={
            failed
              ? tuiColors.danger
              : running
                ? tuiColors.warning
                : tuiColors.cyan
          }
        >
          {" "}
          {entry.text}
        </Text>
      </Box>
    );
  }
  if (entry.kind === "reasoning")
    return (
      <Box marginTop={1} marginLeft={1} flexDirection="column">
        <Text color={tuiColors.muted}>└ Размышления</Text>
        <Box marginLeft={2}>
          <RichContent content={entry.text} muted />
        </Box>
      </Box>
    );
  const config = {
    assistant: { title: "✻", color: tuiColors.accent, muted: false },
    system: { title: "●", color: tuiColors.muted, muted: false },
    error: { title: "× Ошибка", color: tuiColors.danger, muted: false },
  }[entry.kind];
  return (
    <Box marginTop={1} flexDirection="column" marginLeft={1}>
      <Text bold color={config.color}>
        {config.title}
      </Text>
      <Box marginLeft={2}>
        <RichContent content={entry.text} muted={config.muted} />
      </Box>
    </Box>
  );
}

function attachmentType(fileName: string, mimeType: string): string {
  return fileName.split(".").at(-1)?.toUpperCase() || mimeType || "Файл";
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} Б`;
  if (value < 1_048_576) return `${Math.round(value / 1024)} КБ`;
  return `${(value / 1_048_576).toFixed(1)} МБ`;
}
