import type { RefObject } from "react";
import { Box, Text, type DOMElement } from "ink";
import { tuiColors } from "../theme";
import { visibleWindow } from "../windowing";

export interface SelectionItem {
  label: string;
  hint?: string;
  value: string;
}

export function SelectionPanel(props: {
  title: string;
  items: SelectionItem[];
  selected: number;
  selectedValues?: string[];
  multiSelect?: boolean;
  maxItems?: number;
  listRef?: RefObject<DOMElement | null>;
  mouse?: boolean;
}) {
  const { start, count } = visibleWindow(
    props.selected,
    props.items.length,
    Math.max(1, props.maxItems ?? 10),
  );
  const visibleItems = props.items.slice(start, start + count);
  const hidden = props.items.length - count;
  return (
    <Box
      flexShrink={0}
      marginTop={1}
      borderStyle="round"
      borderColor={tuiColors.border}
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color={tuiColors.text}>
        {props.title}
        {hidden > 0 ? (
          <Text color={tuiColors.subtle}>
            {"  "}
            {props.selected + 1}/{props.items.length}
          </Text>
        ) : null}
      </Text>
      <Box ref={props.listRef} flexDirection="column">
        {visibleItems.map((item, index) => {
          const absoluteIndex = start + index;
          const active = absoluteIndex === props.selected;
          const checked = props.selectedValues?.includes(item.value) ?? false;
          const marker = props.multiSelect
            ? checked
              ? "◉"
              : "○"
            : active
              ? "●"
              : "○";
          const background = active ? tuiColors.panelSelected : undefined;
          return (
            <Text
              key={item.value}
              backgroundColor={background}
              wrap="truncate-end"
            >
              <Text
                bold={active}
                color={active ? tuiColors.accent : tuiColors.subtle}
                backgroundColor={background}
              >
                {active ? "›" : " "} {marker}{" "}
              </Text>
              <Text
                bold={active}
                color={active ? tuiColors.text : tuiColors.muted}
                backgroundColor={background}
              >
                {item.label}
              </Text>
              {item.hint ? (
                <Text color={tuiColors.subtle} backgroundColor={background}>
                  {" "}
                  · {item.hint}
                </Text>
              ) : null}
            </Text>
          );
        })}
      </Box>
      <Text color={tuiColors.subtle}>
        {props.multiSelect
          ? "↑↓ выбрать · Space отметить · Enter подтвердить · Esc назад"
          : "↑↓ выбрать · Enter подтвердить · Esc назад"}
        {props.mouse ? " · клик мышью" : ""}
      </Text>
    </Box>
  );
}
