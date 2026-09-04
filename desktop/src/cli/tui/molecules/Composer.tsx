import type { RefObject } from "react";
import { Box, Text, type DOMElement } from "ink";
import { tuiColors } from "../theme";
import { wrapDraft, pointFromOffset } from "../editing";
import type { CliAttachment } from "../attachments";
import type { CliSkillOption } from "../autocomplete";

/** Рамка, отступы и стрелка приглашения — их вычитаем из ширины поля ввода. */
const CHROME_COLUMNS = 6;

/** Ширина текста внутри рамки поля ввода. */
export function composerTextWidth(width: number): number {
  return Math.max(8, width - CHROME_COLUMNS);
}

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
  width: number;
  queued: string[];
  attachments: readonly CliAttachment[];
  skills: readonly CliSkillOption[];
  inputRef?: RefObject<DOMElement | null>;
  focusColor?: string;
}) {
  const visibleQueue = props.queued.slice(0, 3);
  const hiddenQueueCount = props.queued.length - visibleQueue.length;
  const textWidth = composerTextWidth(props.width);
  const rows = wrapDraft(props.value, textWidth);
  const caret = pointFromOffset(rows, props.cursor);

  return (
    <Box flexShrink={0} flexDirection="column" marginTop={1}>
      {visibleQueue.length > 0 && (
        <Box flexDirection="column" paddingX={1}>
          {visibleQueue.map((message, index) => (
            <Text key={index} color={tuiColors.muted}>
              ⏳ в очереди · {truncate(message, textWidth - 14)}
            </Text>
          ))}
          {hiddenQueueCount > 0 && (
            <Text color={tuiColors.muted}> … ещё {hiddenQueueCount}</Text>
          )}
        </Box>
      )}
      {props.attachments.length > 0 && (
        <Box flexDirection="column" paddingX={1}>
          {props.attachments.map((file) => (
            <Text key={file.path} color={tuiColors.text}>
              <Text color={tuiColors.cyan}>▣ </Text>
              {truncate(file.fileName, 54)}{" "}
              <Text color={tuiColors.muted}>· {formatBytes(file.size)}</Text>
            </Text>
          ))}
        </Box>
      )}
      {props.skills.length > 0 && (
        <Box flexDirection="column" paddingX={1}>
          {props.skills.map((skill) => (
            <Text key={skill.id} color={tuiColors.accent}>
              ◆ навык · {skill.name}{" "}
              <Text color={tuiColors.muted}>({skill.slug})</Text>
            </Text>
          ))}
        </Box>
      )}
      <Box
        borderStyle="single"
        borderTop={true}
        borderBottom={true}
        borderLeft={false}
        borderRight={false}
        borderColor={props.focusColor ?? tuiColors.border}
        paddingX={1}
      >
        <Box flexShrink={0} flexDirection="column">
          {rows.map((_row, index) => (
            <Text key={index} bold color={tuiColors.accent}>
              {index === 0 ? "› " : "  "}
            </Text>
          ))}
        </Box>
        <Box ref={props.inputRef} flexGrow={1} flexDirection="column">
          {props.value
            ? rows.map((row, index) => (
                <Text key={index} color={tuiColors.text} wrap="truncate-end">
                  {index === caret.row ? (
                    <>
                      {row.text.slice(0, caret.column)}
                      <Text inverse>
                        {row.text.slice(caret.column, caret.column + 1) || " "}
                      </Text>
                      {row.text.slice(caret.column + 1)}
                    </>
                  ) : (
                    row.text || " "
                  )}
                </Text>
              ))
            : [
                <Text key="placeholder" wrap="truncate-end">
                  <Text inverse color={tuiColors.muted}>
                    {props.prompt.slice(0, 1) || " "}
                  </Text>
                  <Text color={tuiColors.muted}>{props.prompt.slice(1)}</Text>
                </Text>,
              ]}
        </Box>
      </Box>
    </Box>
  );
}

function formatBytes(value: number): string {
  return value < 1_048_576
    ? `${Math.max(1, Math.round(value / 1024))} КБ`
    : `${(value / 1_048_576).toFixed(1)} МБ`;
}
