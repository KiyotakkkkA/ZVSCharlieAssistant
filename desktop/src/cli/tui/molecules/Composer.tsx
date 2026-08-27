import { Box, Text } from "ink";
import { EditableText } from "../atoms/EditableText";
import { tuiColors } from "../theme";

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
  attached?: boolean;
}) {
  const visibleQueue = props.queued.slice(0, 3);
  const hiddenQueueCount = props.queued.length - visibleQueue.length;
  return (
    <Box flexDirection="column" marginTop={props.attached ? 0 : 1}>
      {visibleQueue.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          {visibleQueue.map((message, index) => (
            <Text key={index} color={tuiColors.muted}>
              {"  "}⏸ {truncate(message)}
            </Text>
          ))}
          {hiddenQueueCount > 0 && (
            <Text color={tuiColors.muted}>
              {"  "}… и ещё {hiddenQueueCount}
            </Text>
          )}
        </Box>
      )}
      <Box borderStyle="round" borderColor={tuiColors.muted} paddingX={1}>
        <Text color={tuiColors.accent}>❯ </Text>
        {props.value ? (
          <EditableText value={props.value} cursor={props.cursor} />
        ) : (
          <Text color={tuiColors.muted}>{props.prompt}</Text>
        )}
      </Box>
    </Box>
  );
}
