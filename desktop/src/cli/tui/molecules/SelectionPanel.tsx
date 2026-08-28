import { Box, Text } from "ink";
import { tuiColors } from "../theme";

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
}) {
  return (
    <Box
      marginTop={1}
      borderStyle="single"
      borderLeft={false}
      borderRight={false}
      borderColor={tuiColors.subtle}
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color={tuiColors.text}>
        {props.title}
      </Text>
      {props.items.map((item, index) => {
        const checked = props.selectedValues?.includes(item.value) ?? false;
        const marker = props.multiSelect
          ? checked
            ? "◉"
            : "○"
          : index === props.selected
            ? "●"
            : "○";
        return (
          <Text
            key={item.value}
            color={
              index === props.selected ? tuiColors.text : tuiColors.muted
            }
            backgroundColor={
              index === props.selected
                ? tuiColors.panelSelected
                : undefined
            }
          >
            {index === props.selected ? "›" : " "} {marker} {item.label}
            {item.hint ? ` · ${item.hint}` : ""}
          </Text>
        );
      })}
      <Text color={tuiColors.muted}>
        {props.multiSelect
          ? "↑↓ выбрать · Space отметить · Enter подтвердить · Esc назад"
          : "↑↓ выбрать · Enter подтвердить · Esc назад"}
      </Text>
    </Box>
  );
}
