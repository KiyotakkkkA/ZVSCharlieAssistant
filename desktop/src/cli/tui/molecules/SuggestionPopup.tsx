import { Box, Text } from "ink";
import type { CompletionItem } from "../autocomplete";
import { tuiColors } from "../theme";

export function SuggestionPopup(props: {
  items: CompletionItem[];
  selected: number;
  prefix?: "@" | "@file" | "@skill" | "!";
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
        borderStyle="single"
        borderColor={tuiColors.subtle}
        backgroundColor={tuiColors.panel}
        flexDirection="column"
        paddingX={1}
        width="100%"
      >
        <Text color={tuiColors.text} backgroundColor={tuiColors.panel}>
          {props.prefix === "@"
            ? "@file — вложение · @skill — навык для следующего запроса"
            : props.prefix === "@file"
              ? "@file — выбрать файл внутри текущего проекта"
              : props.prefix === "@skill"
                ? "@skill — явно загрузить навык для следующего запроса"
                : "! — выполнить shell-команду в папке проекта"}
        </Text>
      </Box>
    );
  if (!props.items.length) return null;
  return (
    <Box
      borderStyle="single"
      borderColor={tuiColors.subtle}
      backgroundColor={tuiColors.panel}
      flexDirection="column"
      paddingX={1}
      width="100%"
    >
      {visibleItems.map((item, index) => {
        const absoluteIndex = start + index;
        return (
          <Text
            key={item.value}
            color={
              absoluteIndex === props.selected
                ? tuiColors.text
                : tuiColors.muted
            }
            backgroundColor={
              absoluteIndex === props.selected
                ? tuiColors.panelSelected
                : tuiColors.panel
            }
          >
            {absoluteIndex === props.selected ? "›" : " "}{" "}
            {item.kind === "directory"
              ? "▸"
              : item.kind === "file"
                ? "▪"
                : item.kind === "skill"
                  ? "◆"
                  : item.kind === "mode"
                    ? "@"
                    : ""}{" "}
            {item.label} · {item.description}
          </Text>
        );
      })}
      <Text color={tuiColors.muted} backgroundColor={tuiColors.panel}>
        ↑↓ выбрать · Tab дополнить · Enter выполнить
      </Text>
    </Box>
  );
}
