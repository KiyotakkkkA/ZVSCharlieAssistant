import { Box, Text } from "ink";
import { EditableText } from "../atoms/EditableText";
import { tuiColors } from "../theme";

export function Composer(props: { prompt: string; value: string; cursor: number; queued: number }) {
  return (
    <Box marginTop={1}>
      <Text color={tuiColors.accent}>❯ </Text>
      {props.value ? <EditableText value={props.value} cursor={props.cursor} /> : <Text color={tuiColors.muted}>{props.prompt}</Text>}
      {props.queued > 0 && <Text color={tuiColors.cyan}> · очередь {props.queued}</Text>}
    </Box>
  );
}
