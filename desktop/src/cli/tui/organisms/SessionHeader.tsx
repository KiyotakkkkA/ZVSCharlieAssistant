import { Box, Text } from "ink";
import { PhaseBadge } from "../atoms/PhaseBadge";
import type { TuiPhase } from "../state";
import { tuiColors } from "../theme";

export function SessionHeader(props: {
  version: string;
  model: string;
  project: string;
  permission: string;
  phase: TuiPhase;
}) {
  return (
    <Box
      borderStyle="round"
      borderColor={tuiColors.accent}
      paddingX={1}
      justifyContent="space-between"
      flexShrink={0}
    >
      <Text bold color={tuiColors.accent}>
        ZVS Assistant <Text dimColor>v{props.version}</Text>
      </Text>
      <Text>
        {props.model} <Text color={tuiColors.muted}>·</Text> {props.project}{" "}
        <Text color={tuiColors.muted}>·</Text> {props.permission}{" "}
        <Text color={tuiColors.muted}>·</Text>{" "}
        <PhaseBadge phase={props.phase} />
      </Text>
    </Box>
  );
}
