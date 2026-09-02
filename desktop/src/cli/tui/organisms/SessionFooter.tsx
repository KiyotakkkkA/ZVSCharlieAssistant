import { Box, Text } from "ink";
import { PhaseBadge } from "../atoms/PhaseBadge";
import type { TuiPhase } from "../state";
import { tuiColors } from "../theme";

/**
 * Нижняя строка сессии. Левая часть — режим и подсказка, правая — конфигурация.
 * Обе колонки усечены по ширине: раньше строка переносилась и налезала сама на
 * себя на узких терминалах.
 */
export function SessionFooter(props: {
  version: string;
  model: string;
  project: string;
  projectPath?: string;
  permission: string;
  phase: TuiPhase;
  hint?: string;
  width: number;
}) {
  const leftWidth = Math.max(12, Math.floor(props.width * 0.42));
  const rightText = fitSummary(
    [
      props.model,
      props.project,
      props.projectPath ? shortenPath(props.projectPath) : undefined,
      `v${props.version}`,
    ].filter((part): part is string => Boolean(part)),
    Math.max(8, props.width - leftWidth - 2),
  );

  return (
    <Box flexShrink={0} flexDirection="column" paddingX={1}>
      {props.hint ? (
        <Text color={tuiColors.subtle} wrap="truncate-end">
          {props.hint}
        </Text>
      ) : null}
      <Box>
        <Box width={leftWidth} flexShrink={0}>
          <Text color={tuiColors.accent} wrap="truncate-end">
            ▸ <Text bold>{props.permission}</Text>{" "}
            <Text color={tuiColors.subtle}>·</Text>{" "}
            <PhaseBadge phase={props.phase} />
          </Text>
        </Box>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text color={tuiColors.subtle} wrap="truncate-start">
            {rightText}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Собирает правую колонку по ширине: части перечислены по убыванию важности,
 * лишние отбрасываются целиком, чтобы строка не резалась посередине слова.
 */
export function fitSummary(parts: string[], width: number): string {
  for (let count = parts.length; count > 0; count -= 1) {
    const text = parts.slice(0, count).join(" · ");
    if (text.length <= width) return text;
  }
  return parts[0]?.slice(0, width) ?? "";
}

function shortenPath(value: string): string {
  const parts = value.split(/[\/]/).filter(Boolean);
  return parts.length <= 2 ? value : `…/${parts.slice(-2).join("/")}`;
}
