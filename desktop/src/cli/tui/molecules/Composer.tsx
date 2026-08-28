import { Box, Text } from "ink";
import { EditableText } from "../atoms/EditableText";
import { tuiColors } from "../theme";
import type { CliAttachment } from "../attachments";
import type { CliSkillOption } from "../autocomplete";

function truncate(text: string, width = 64): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length <= width
    ? singleLine
    : `${singleLine.slice(0, Math.max(0, width - 1))}…`;
}

export function Composer(props: {
  prompt: string;
  value: string;
  cursor: number;
  queued: string[];
  attachments: readonly CliAttachment[];
  skills: readonly CliSkillOption[];
}) {
  const visibleQueue = props.queued.slice(0, 3);
  const hiddenQueueCount = props.queued.length - visibleQueue.length;
  return (
    <Box flexShrink={0} flexDirection="column" marginTop={1}>
      {visibleQueue.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          {visibleQueue.map((message, index) => (
            <Text key={index} color={tuiColors.muted}>
              {"  "}└ queued · {truncate(message)}
            </Text>
          ))}
          {hiddenQueueCount > 0 && (
            <Text color={tuiColors.muted}>
              {"  "}└ ещё {hiddenQueueCount}
            </Text>
          )}
        </Box>
      )}
      {props.attachments.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          {props.attachments.map((file) => (
            <Text key={file.path} color={tuiColors.text}>
              {"  "}▣ {truncate(file.fileName, 54)}{" "}
              <Text color={tuiColors.muted}>· {formatBytes(file.size)}</Text>
            </Text>
          ))}
          <Text color={tuiColors.muted}>
            {"  "}Backspace в пустом поле — убрать последний контекст
          </Text>
        </Box>
      )}
      {props.skills.length > 0 && (
        <Box flexDirection="column">
          {props.skills.map((skill) => (
            <Text key={skill.id} color={tuiColors.accent}>
              {"  "}◆ skill · {skill.name}{" "}
              <Text color={tuiColors.muted}>({skill.slug})</Text>
            </Text>
          ))}
          <Text color={tuiColors.muted}>
            {"  "}Backspace в пустом поле — убрать последний контекст
          </Text>
        </Box>
      )}
      <Box
        borderStyle="single"
        borderLeft={false}
        borderRight={false}
        borderColor={tuiColors.subtle}
        paddingX={1}
      >
        <Text bold color={tuiColors.text}>› </Text>
        {props.value ? (
          <EditableText value={props.value} cursor={props.cursor} />
        ) : (
          <Text color={tuiColors.muted}>{props.prompt}</Text>
        )}
      </Box>
    </Box>
  );
}

function formatBytes(value: number): string {
  return value < 1_048_576
    ? `${Math.max(1, Math.round(value / 1024))} КБ`
    : `${(value / 1_048_576).toFixed(1)} МБ`;
}
