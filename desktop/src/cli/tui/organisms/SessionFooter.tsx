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
    <Box flexShrink={0} flexDirection="column">
      {props.hint ? (
        <Text color={tuiColors.muted}>{props.hint}</Text>
      ) : null}
      <Box justifyContent="space-between">
        <Text bold color={tuiColors.accent}>
          ZVS Assistant <Text dimColor>v{props.version}</Text>
        </Text>
        <Box flexShrink={1} justifyContent="flex-end">
          <Text wrap="truncate-middle">
            {props.model} <Text color={tuiColors.muted}>·</Text>{" "}
            {props.project}
            {props.projectPath ? (
              <>
                {" "}
                <Text color={tuiColors.muted}>·</Text>{" "}
                <Text color={tuiColors.muted}>папка: {props.projectPath}</Text>
              </>
            ) : null}{" "}
            <Text color={tuiColors.muted}>·</Text> {props.permission}{" "}
            <Text color={tuiColors.muted}>·</Text>{" "}
            <PhaseBadge phase={props.phase} />
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
