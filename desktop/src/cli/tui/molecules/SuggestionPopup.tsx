import { Box, Text } from "ink";
import type { CompletionItem } from "../autocomplete";
import { tuiColors } from "../theme";

export function SuggestionPopup(props: { items: CompletionItem[]; selected: number; prefix?: "@" | "!" }) {
  if (props.prefix && !props.items.length)
    return (
      <Box marginLeft={2} flexDirection="column">
        <Text color={tuiColors.warning}>{props.prefix === "@" ? "@ — добавить файл или путь в контекст" : "! — выполнить shell-команду (будет добавлено следующим этапом)"}</Text>
      </Box>
    );
  if (!props.items.length) return null;
  return (
    <Box marginLeft={2} flexDirection="column">
      {props.items.slice(0, 8).map((item, index) => (
        <Text key={item.value} color={index === props.selected ? tuiColors.accent : tuiColors.muted}>
          {index === props.selected ? "›" : " "} {item.kind === "directory" ? "▸" : item.kind === "file" ? "▪" : ""} {item.label}  ·  {item.description}
        </Text>
      ))}
      <Text color={tuiColors.muted}>↑↓ выбрать · Tab дополнить · Enter выполнить</Text>
    </Box>
  );
}
