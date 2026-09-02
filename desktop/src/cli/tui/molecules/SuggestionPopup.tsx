import type { RefObject } from "react";
import { Box, Text, type DOMElement } from "ink";
import type { CompletionItem } from "../autocomplete";
import { tuiColors } from "../theme";
import { visibleWindow } from "../windowing";

const KIND_ICONS: Record<string, string> = {
  directory: "▸",
  file: "▪",
  skill: "◆",
  mode: "@",
};

export function SuggestionPopup(props: {
  items: CompletionItem[];
  selected: number;
  prefix?: "@" | "@file" | "@skill" | "!";
  maxItems?: number;
  listRef?: RefObject<DOMElement | null>;
  mouse?: boolean;
}) {
  const maxItems = Math.max(1, props.maxItems ?? 8);
  const { start, count } = visibleWindow(
    props.selected,
    props.items.length,
    maxItems,
  );
  const visibleItems = props.items.slice(start, start + count);
  const hidden = props.items.length - (start + visibleItems.length);

  if (props.prefix && !props.items.length)
    return (
      <Box
        borderStyle="round"
        borderColor={tuiColors.border}
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
      borderStyle="round"
      borderColor={tuiColors.border}
      backgroundColor={tuiColors.panel}
      flexDirection="column"
      paddingX={1}
      width="100%"
    >
      <Box ref={props.listRef} flexDirection="column">
        {visibleItems.map((item, index) => {
          const absoluteIndex = start + index;
          const active = absoluteIndex === props.selected;
          const background = active ? tuiColors.panelSelected : tuiColors.panel;
          return (
            <Text
              key={item.value}
              color={active ? tuiColors.text : tuiColors.muted}
              backgroundColor={background}
              wrap="truncate-end"
            >
              <Text
                bold={active}
                color={active ? tuiColors.accent : tuiColors.subtle}
                backgroundColor={background}
              >
                {active ? "›" : " "} {KIND_ICONS[item.kind] ?? " "}{" "}
              </Text>
              <Text
                bold={active}
                color={active ? tuiColors.text : tuiColors.muted}
                backgroundColor={background}
              >
                {item.label}
              </Text>
              <Text color={tuiColors.subtle} backgroundColor={background}>
                {item.description ? ` · ${item.description}` : ""}
              </Text>
            </Text>
          );
        })}
      </Box>
      <Text color={tuiColors.subtle} backgroundColor={tuiColors.panel}>
        {hidden > 0 ? `↓ ещё ${hidden} · ` : ""}↑↓ выбрать · Tab дополнить ·
        Enter применить{props.mouse ? " · клик мышью" : ""}
      </Text>
    </Box>
  );
}
