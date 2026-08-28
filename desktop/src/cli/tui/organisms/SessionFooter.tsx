import { Box, Text } from "ink";
import { PhaseBadge } from "../atoms/PhaseBadge";
import type { TuiPhase } from "../state";
import { tuiColors } from "../theme";

export function SessionFooter(props: {
  version: string;
  model: string;
  project: string;
  projectPath?: string;
  permission: string;
  phase: TuiPhase;
  hint?: string;
}) {
  return (
    <Box flexShrink={0} flexDirection="column" paddingX={1}>
      {props.hint ? (
        <Text color={tuiColors.muted}>{props.hint}</Text>
      ) : null}
      <Box justifyContent="space-between">
        <Text color={tuiColors.accent}>
          ▸ <Text bold>{props.permission} mode</Text>{" "}
          <Text color={tuiColors.muted}>· esc — прервать</Text>
        </Text>
        <Box flexShrink={1} justifyContent="flex-end">
          <Text color={tuiColors.muted} wrap="truncate-middle">
            v{props.version} <Text color={tuiColors.muted}>·</Text>{" "}
            {props.model} <Text color={tuiColors.muted}>·</Text>{" "}
            {props.project}
            {props.projectPath ? (
              <>
                {" "}
                <Text color={tuiColors.muted}>·</Text>{" "}
                <Text color={tuiColors.muted}>папка: {props.projectPath}</Text>
              </>
            ) : null}{" "}
            <Text color={tuiColors.muted}> · </Text>
            <PhaseBadge phase={props.phase} />
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
