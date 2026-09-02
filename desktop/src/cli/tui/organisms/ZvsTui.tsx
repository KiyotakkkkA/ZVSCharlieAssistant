import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Box, useInput, useWindowSize, type DOMElement } from "ink";
import type { UserQuestion } from "../../../shared/models/user-question";
import type { RecentChatSession } from "../../../shared/models/chat";
import {
  fileSuggestions,
  skillSuggestions,
  type CliSkillOption,
  type CompletionItem,
} from "../autocomplete";
import { commandSuggestions } from "../commands";
import { Composer, composerTextWidth } from "../molecules/Composer";
import { QuestionPanel } from "../molecules/QuestionPanel";
import {
  SelectionPanel,
  type SelectionItem,
} from "../molecules/SelectionPanel";
import { StatusLine } from "../molecules/StatusLine";
import { SuggestionPopup } from "../molecules/SuggestionPopup";
import { WelcomePanel } from "../molecules/WelcomePanel";
import {
  initialTuiState,
  reduceTuiState,
  type TuiAction,
  type TuiState,
} from "../state";
import { SessionFooter } from "./SessionFooter";
import { Transcript, type TranscriptHandle } from "./Transcript";
import type { CliAttachment } from "../attachments";
import { absoluteRect, containsPoint, rowWithin } from "../geometry";
import { visibleWindow } from "../windowing";
import { useMouse } from "../useMouse";
import { isMouseInput } from "../mouse";
import {
  deleteToLineEnd,
  deleteToLineStart,
  deleteWordAfter,
  deleteWordBefore,
  nextWordBoundary,
  offsetFromPoint,
  pointFromOffset,
  previousWordBoundary,
  wrapDraft,
} from "../editing";

export interface TuiMenu {
  title: string;
  items: SelectionItem[];
}

/** Строк ленты за один щелчок колеса. */
const WHEEL_LINES = 3;
const MENU_MAX_ITEMS = 10;

export interface ZvsTuiProps {
  version: string;
  model: string;
  project: string;
  projectPath?: string;
  permission: string;
  fileRoot?: string;
  recentSessions: RecentChatSession[];
  attachments: readonly CliAttachment[];
  skills: readonly CliSkillOption[];
  selectedSkills: readonly CliSkillOption[];
  state?: TuiState;
  dispatch?: (action: TuiAction) => void;
  menu?: TuiMenu;
  inputPrompt?: string;
  mouseEnabled?: boolean;
  onSubmit: (value: string) => void;
  onQueue: (value: string) => void;
  onCancel: () => void;
  onExit: () => void;
  onAnswer: (question: UserQuestion, answer: string[]) => void;
  onMenuSelect: (value: string) => void;
  onEscape: () => void;
  onAttach: (reference: string) => void;
  onRemoveLastAttachment: () => void;
  onSelectSkill: (skillId: string) => void;
  onRemoveLastSkill: () => void;
}

export function ZvsTui(props: ZvsTuiProps) {
  const [localState, localDispatch] = useReducer(
    reduceTuiState,
    undefined,
    initialTuiState,
  );
  const state = props.state ?? localState;
  const dispatch = props.dispatch ?? localDispatch;
  const [cursor, setCursor] = useState(0);
  const [selectedOption, setSelectedOption] = useState(0);
  const [selectedMenuItem, setSelectedMenuItem] = useState(0);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [exitArmed, setExitArmed] = useState(false);
  const exitArmedTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(exitArmedTimeout.current), []);
  const { rows, columns } = useWindowSize();

  const transcript = useRef<TranscriptHandle>(null);
  const suggestionList = useRef<DOMElement>(null);
  const menuList = useRef<DOMElement>(null);
  const questionList = useRef<DOMElement>(null);
  const composerInput = useRef<DOMElement>(null);

  const mouseEnabled = props.mouseEnabled !== false;
  const options = state.question?.options ?? [];
  const commands = commandSuggestions(state.draft);
  const suggestions: CompletionItem[] = state.draft.startsWith("/")
    ? commands.map((command) => ({
        value: command.name,
        label: `${command.name}${command.usage ? ` ${command.usage}` : ""}`,
        description: command.description,
        kind: "command",
        appendSpace: Boolean(command.usage),
      }))
    : namespaceSuggestions(
        state.draft,
        props.fileRoot ?? process.cwd(),
        props.skills,
      );
  const specialPrefix =
    state.draft === "@"
      ? "@"
      : state.draft === "@file "
        ? "@file"
        : state.draft === "@skill "
          ? "@skill"
          : state.draft.startsWith("!") && !state.draft.includes(" ")
            ? "!"
            : undefined;
  const suggestionsVisible =
    !props.menu &&
    !state.question &&
    (suggestions.length > 0 || specialPrefix !== undefined);
  const suggestionMaxItems = Math.max(1, Math.min(8, rows - 6));
  const draftRows = wrapDraft(state.draft, composerTextWidth(columns));
  const caret = pointFromOffset(draftRows, cursor);

  useEffect(() => setCursor(state.draft.length), [state.question?.id]);
  useEffect(() => {
    setSelectedOption(0);
    setSelectedOptions([]);
  }, [state.question?.id]);
  useEffect(() => setSelectedMenuItem(0), [props.menu?.title]);
  useEffect(() => setSelectedSuggestion(0), [state.draft]);

  const setDraft = (value: string) => {
    dispatch({ type: "draft.changed", value });
    setCursor(value.length);
  };
  const editDraft = (edit: { value: string; cursor: number }) => {
    dispatch({ type: "draft.changed", value: edit.value });
    setCursor(Math.max(0, Math.min(edit.value.length, edit.cursor)));
  };
  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setHistory((items) =>
      [trimmed, ...items.filter((item) => item !== trimmed)].slice(0, 200),
    );
    setHistoryIndex(-1);
    if (state.question) props.onAnswer(state.question, [trimmed]);
    else props.onSubmit(trimmed);
    setDraft("");
  };

  /** Общий путь для Tab, Enter и клика по строке подсказки. */
  const applySuggestion = (item: CompletionItem | undefined): boolean => {
    if (!item) return false;
    if (item.kind === "file") {
      props.onAttach(item.value);
      setDraft("");
      return true;
    }
    if (item.kind === "skill") {
      props.onSelectSkill(item.value);
      setDraft("");
      return true;
    }
    setDraft(`${item.value}${item.appendSpace ? " " : ""}`);
    return true;
  };

  const answerOption = (index: number) => {
    const question = state.question;
    const option = options[index];
    if (!question || !option) return;
    setSelectedOption(index);
    if (question.multiSelect) {
      setSelectedOptions((values) =>
        values.includes(option.label)
          ? values.filter((value) => value !== option.label)
          : [...values, option.label],
      );
      return;
    }
    props.onAnswer(question, [option.label]);
  };

  useMouse(
    (event) => {
      if (event.kind === "wheel") {
        const step = event.direction === "up" ? -1 : 1;
        if (suggestionsVisible && suggestions.length)
          setSelectedSuggestion(
            (value) => (value + step + suggestions.length) % suggestions.length,
          );
        else if (props.menu?.items.length)
          setSelectedMenuItem(
            (value) =>
              (value + step + props.menu!.items.length) %
              props.menu!.items.length,
          );
        else if (state.question && options.length)
          setSelectedOption(
            (value) => (value + step + options.length) % options.length,
          );
        else
          transcript.current?.scrollBy(
            event.direction === "up" ? WHEEL_LINES : -WHEEL_LINES,
          );
        return;
      }
      if (event.kind !== "press" || event.button !== "left") return;

      if (suggestionsVisible && suggestions.length) {
        const row = rowWithin(absoluteRect(suggestionList.current), event.y);
        if (row !== undefined) {
          const { start } = visibleWindow(
            selectedSuggestion,
            suggestions.length,
            suggestionMaxItems,
          );
          const item = suggestions[start + row];
          if (item) {
            setSelectedSuggestion(start + row);
            applySuggestion(item);
          }
          return;
        }
      }
      if (props.menu?.items.length) {
        const row = rowWithin(absoluteRect(menuList.current), event.y);
        if (row !== undefined) {
          const { start } = visibleWindow(
            selectedMenuItem,
            props.menu.items.length,
            MENU_MAX_ITEMS,
          );
          const item = props.menu.items[start + row];
          if (item) {
            setSelectedMenuItem(start + row);
            props.onMenuSelect(item.value);
          }
        }
        return;
      }
      if (state.question && options.length) {
        const row = rowWithin(absoluteRect(questionList.current), event.y);
        if (row !== undefined) {
          const { start } = visibleWindow(
            selectedOption,
            options.length,
            MENU_MAX_ITEMS,
          );
          answerOption(start + row);
        }
        return;
      }
      const inputRect = absoluteRect(composerInput.current);
      if (inputRect && containsPoint(inputRect, event.x, event.y))
        setCursor(
          offsetFromPoint(
            wrapDraft(state.draft, inputRect.width),
            event.y - inputRect.top,
            event.x - inputRect.left,
          ),
        );
    },
    { isActive: mouseEnabled },
  );

  useInput((input, key) => {
    if (isMouseInput(input)) return;
    if (key.ctrl && input === "c") {
      if (
        state.phase === "running" ||
        state.phase === "waiting-user" ||
        state.phase === "cancelling"
      ) {
        props.onCancel();
        return;
      }
      if (exitArmed) {
        clearTimeout(exitArmedTimeout.current);
        props.onExit();
        return;
      }
      setExitArmed(true);
      exitArmedTimeout.current = setTimeout(() => setExitArmed(false), 2000);
      return;
    }
    if (exitArmed) setExitArmed(false);
    if (key.escape && !props.menu && !state.question && !props.inputPrompt) {
      if (state.phase === "running") {
        props.onCancel();
        return;
      }
    }
    if (props.menu) {
      if (key.escape) props.onEscape();
      else if (key.upArrow)
        setSelectedMenuItem(
          (value) =>
            (value - 1 + props.menu!.items.length) % props.menu!.items.length,
        );
      else if (key.downArrow)
        setSelectedMenuItem((value) => (value + 1) % props.menu!.items.length);
      else if (key.return) {
        const item = props.menu.items[selectedMenuItem];
        if (item) props.onMenuSelect(item.value);
      }
      return;
    }
    if (key.escape && (state.question || props.inputPrompt)) {
      props.onEscape();
      return;
    }
    if (state.question && options.length) {
      if (key.upArrow)
        setSelectedOption(
          (value) => (value - 1 + options.length) % options.length,
        );
      else if (key.downArrow)
        setSelectedOption((value) => (value + 1) % options.length);
      else if (input === " " && state.question.multiSelect)
        answerOption(selectedOption);
      else if (key.return) {
        const option = options[selectedOption];
        const answer = state.question.multiSelect
          ? selectedOptions
          : option
            ? [option.label]
            : [];
        if (answer.length) props.onAnswer(state.question, answer);
      }
      return;
    }
    if (key.escape && state.draft) {
      setDraft("");
      return;
    }
    if (key.ctrl && input === "w") {
      editDraft(deleteWordBefore(state.draft, cursor));
      return;
    }
    if (key.ctrl && input === "u") {
      editDraft(deleteToLineStart(state.draft, cursor));
      return;
    }
    if (key.ctrl && input === "k") {
      editDraft(deleteToLineEnd(state.draft, cursor));
      return;
    }
    if (key.ctrl && input === "l") {
      transcript.current?.scrollToBottom();
      return;
    }
    if (key.home || (key.ctrl && input === "a")) {
      setCursor(0);
      return;
    }
    if (key.end || (key.ctrl && input === "e")) {
      setCursor(state.draft.length);
      return;
    }
    if (suggestions.length && key.upArrow) {
      setSelectedSuggestion(
        (value) => (value - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }
    if (suggestions.length && key.downArrow) {
      setSelectedSuggestion((value) => (value + 1) % suggestions.length);
      return;
    }
    if (key.upArrow && caret.row > 0) {
      setCursor(offsetFromPoint(draftRows, caret.row - 1, caret.column));
      return;
    }
    if (key.downArrow && caret.row < draftRows.length - 1) {
      setCursor(offsetFromPoint(draftRows, caret.row + 1, caret.column));
      return;
    }
    if (key.upArrow && history.length) {
      const next = Math.min(history.length - 1, historyIndex + 1);
      setHistoryIndex(next);
      setDraft(history[next] ?? "");
      return;
    }
    if (key.downArrow && historyIndex >= 0) {
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setDraft(next >= 0 ? (history[next] ?? "") : "");
      return;
    }
    if (key.leftArrow) {
      setCursor((value) =>
        key.ctrl || key.meta
          ? previousWordBoundary(state.draft, value)
          : Math.max(0, value - 1),
      );
      return;
    }
    if (key.rightArrow) {
      setCursor((value) =>
        key.ctrl || key.meta
          ? nextWordBoundary(state.draft, value)
          : Math.min(state.draft.length, value + 1),
      );
      return;
    }
    if (key.backspace) {
      if (cursor === 0) {
        if (!state.draft && props.selectedSkills.length)
          props.onRemoveLastSkill();
        else if (!state.draft && props.attachments.length)
          props.onRemoveLastAttachment();
        return;
      }
      if (key.ctrl || key.meta) {
        editDraft(deleteWordBefore(state.draft, cursor));
        return;
      }
      dispatch({
        type: "draft.changed",
        value: state.draft.slice(0, cursor - 1) + state.draft.slice(cursor),
      });
      setCursor((value) => Math.max(0, value - 1));
      return;
    }
    if (key.delete) {
      if (cursor >= state.draft.length) return;
      if (key.ctrl || key.meta) {
        editDraft(deleteWordAfter(state.draft, cursor));
        return;
      }
      dispatch({
        type: "draft.changed",
        value: state.draft.slice(0, cursor) + state.draft.slice(cursor + 1),
      });
      return;
    }
    if (key.tab) {
      if (applySuggestion(suggestions[selectedSuggestion])) return;
      if (state.phase === "running") {
        props.onQueue(state.draft);
        dispatch({ type: "message.queued", value: state.draft });
        setCursor(0);
      }
      return;
    }
    if (key.return) {
      if (key.shift || key.meta) {
        dispatch({
          type: "draft.changed",
          value:
            state.draft.slice(0, cursor) + "\n" + state.draft.slice(cursor),
        });
        setCursor((value) => value + 1);
        return;
      }
      const selected = suggestions[selectedSuggestion];
      if (
        selected?.kind === "file" ||
        selected?.kind === "skill" ||
        selected?.kind === "directory"
      ) {
        applySuggestion(selected);
        return;
      }
      const exactCommand = suggestions.find(
        (suggestion) => suggestion.value === state.draft.trim(),
      );
      submit(
        exactCommand ? exactCommand.value : (selected?.value ?? state.draft),
      );
      return;
    }
    if (!key.ctrl && !key.meta && input) {
      dispatch({
        type: "draft.changed",
        value: state.draft.slice(0, cursor) + input + state.draft.slice(cursor),
      });
      setCursor((value) => value + input.length);
    }
  });

  const prompt = useMemo(() => {
    if (props.inputPrompt) return props.inputPrompt;
    if (state.question) return "Ответ";
    if (state.phase === "running")
      return "Следующее сообщение · Tab — в очередь";
    return "Спросите что-нибудь · / команды · @ контекст · ! shell";
  }, [props.inputPrompt, state.phase, state.question]);

  const busy = state.phase === "running" || state.phase === "cancelling";
  const footerHint = footerHintFor({
    exitArmed,
    menu: Boolean(props.menu),
    question: Boolean(state.question),
    suggestions: suggestionsVisible,
    busy,
    draft: Boolean(state.draft),
  });

  return (
    <Box flexDirection="column" height={Math.max(1, rows)}>
      <Box
        position="relative"
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        overflowY="hidden"
      >
        <Transcript
          handleRef={transcript}
          entries={state.transcript}
          scrollEnabled={!props.menu && !state.question}
          emptyContent={
            <WelcomePanel
              sessions={props.recentSessions}
              version={props.version}
              model={props.model}
              project={props.project}
              mouse={mouseEnabled}
            />
          }
        />
        {suggestionsVisible ? (
          <Box position="absolute" bottom={0} width="100%">
            <SuggestionPopup
              items={suggestions}
              selected={selectedSuggestion}
              prefix={specialPrefix}
              maxItems={suggestionMaxItems}
              listRef={suggestionList}
              mouse={mouseEnabled}
            />
          </Box>
        ) : null}
      </Box>
      {state.question && (
        <QuestionPanel
          question={state.question}
          selected={selectedOption}
          selectedValues={selectedOptions}
          maxItems={MENU_MAX_ITEMS}
          listRef={questionList}
          mouse={mouseEnabled}
        />
      )}
      {props.menu && (
        <SelectionPanel
          title={props.menu.title}
          items={props.menu.items}
          selected={selectedMenuItem}
          maxItems={MENU_MAX_ITEMS}
          listRef={menuList}
          mouse={mouseEnabled}
        />
      )}
      {busy && (
        <StatusLine
          phase={state.phase}
          seed={state.activeRunId ?? "idle"}
          startedAt={state.runStartedAt}
          queued={state.queued.length}
        />
      )}
      <Composer
        prompt={prompt}
        value={state.draft}
        cursor={cursor}
        width={columns}
        queued={state.queued}
        attachments={props.attachments}
        skills={props.selectedSkills}
        inputRef={composerInput}
      />
      <SessionFooter
        version={props.version}
        model={props.model}
        project={props.project}
        projectPath={props.projectPath}
        permission={props.permission}
        hint={footerHint}
        phase={state.phase}
        width={columns}
      />
    </Box>
  );
}

/** Подсказка под составителем: показывает то, что уместно прямо сейчас. */
export function footerHintFor(context: {
  exitArmed: boolean;
  menu: boolean;
  question: boolean;
  suggestions: boolean;
  busy: boolean;
  draft: boolean;
}): string | undefined {
  if (context.exitArmed) return "Ctrl+C ещё раз — выйти";
  if (context.menu || context.suggestions) return undefined;
  if (context.question) return "↑↓ выбрать · Enter ответить · Esc отменить";
  if (context.busy) return "Esc прервать · Tab поставить сообщение в очередь";
  if (context.draft)
    return "Enter отправить · Shift+Enter перенос строки · Esc очистить";
  return "/help — команды и горячие клавиши";
}

function namespaceSuggestions(
  draft: string,
  fileRoot: string,
  skills: readonly CliSkillOption[],
): CompletionItem[] {
  if (!draft.startsWith("@")) return [];
  if (/^@(f(i(l(e)?)?)?|s(k(i(l(l)?)?)?)?)?$/i.test(draft)) {
    const query = draft.slice(1).toLocaleLowerCase();
    return [
      {
        value: "@file",
        label: "file",
        description: "прикрепить файл из проекта",
        kind: "mode" as const,
        appendSpace: true,
      },
      {
        value: "@skill",
        label: "skill",
        description: "загрузить навык для следующего запроса",
        kind: "mode" as const,
        appendSpace: true,
      },
    ].filter((item) => item.value.slice(1).startsWith(query));
  }
  if (/^@file(?:\s|$)/i.test(draft)) return fileSuggestions(fileRoot, draft);
  if (/^@skill(?:\s|$)/i.test(draft)) return skillSuggestions(skills, draft);
  return [];
}
