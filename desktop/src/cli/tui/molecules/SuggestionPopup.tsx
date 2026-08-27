import { Box, Text } from "ink";
import type { CompletionItem } from "../autocomplete";
import { tuiColors } from "../theme";

export function SuggestionPopup(props: {
  items: CompletionItem[];
  selected: number;
  prefix?: "@" | "!";
  maxItems?: number;
}) {
  const maxItems = Math.max(1, props.maxItems ?? 8);
  const start = Math.max(
    0,
    Math.min(props.selected - maxItems + 1, props.items.length - maxItems),
  );
  const visibleItems = props.items.slice(start, start + maxItems);
  if (props.prefix && !props.items.length)
    return (
      <Box
        borderStyle="round"
        borderColor={tuiColors.accent}
        flexDirection="column"
        paddingX={1}
      >
        <Text color={tuiColors.warning}>
          {props.prefix === "@"
            ? "@ — добавить файл или путь в контекст"
            : "! — выполнить shell-команду (будет добавлено следующим этапом)"}
        </Text>
      </Box>
    );
  if (!props.items.length) return null;
  return (
    <Box
      borderStyle="round"
      borderColor={tuiColors.accent}
      flexDirection="column"
      paddingX={1}
    >
      {visibleItems.map((item, index) => {
        const absoluteIndex = start + index;
        return (
          <Text
            key={item.value}
            color={
              absoluteIndex === props.selected
                ? tuiColors.accent
                : tuiColors.muted
            }
          >
            {absoluteIndex === props.selected ? "›" : " "}{" "}
            {item.kind === "directory" ? "▸" : item.kind === "file" ? "▪" : ""}{" "}
            {item.label} · {item.description}
          </Text>
        );
      })}
      <Text color={tuiColors.muted}>
        ↑↓ выбрать · Tab дополнить · Enter выполнить
      </Text>
    </Box>
  );
}
