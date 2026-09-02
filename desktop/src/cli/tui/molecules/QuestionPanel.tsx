import type { RefObject } from "react";
import { Box, Text, type DOMElement } from "ink";
import type { UserQuestion } from "../../../shared/models/user-question";
import { tuiColors } from "../theme";
import { SelectionPanel } from "./SelectionPanel";

export function QuestionPanel(props: {
  question: UserQuestion;
  selected: number;
  selectedValues: string[];
  maxItems?: number;
  listRef?: RefObject<DOMElement | null>;
  mouse?: boolean;
}) {
  if (props.question.options.length)
    return (
      <Box flexDirection="column">
        <Box flexShrink={0} marginTop={1} paddingX={1} flexDirection="column">
          <Text bold color={tuiColors.accent}>
            {props.question.header || "Требуется решение"}
          </Text>
          <Text>{props.question.question}</Text>
        </Box>
        <SelectionPanel
          title="Варианты ответа"
          items={props.question.options.map((option) => ({
            label: option.label,
            hint: option.description,
            value: option.label,
          }))}
          selected={props.selected}
          selectedValues={props.selectedValues}
          multiSelect={props.question.multiSelect}
          maxItems={props.maxItems}
          listRef={props.listRef}
          mouse={props.mouse}
        />
      </Box>
    );
  return (
    <Box
      flexShrink={0}
      marginTop={1}
      borderStyle="round"
      borderColor={tuiColors.border}
      paddingX={1}
      flexDirection="column"
    >
      <Text bold color={tuiColors.accent}>
        {props.question.header || "Требуется решение"}
      </Text>
      <Text>{props.question.question}</Text>
      <Text color={tuiColors.muted}>
        Введите ответ в composer · Esc отменить
      </Text>
    </Box>
  );
}
