import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { render } from "ink";
import { EventEmitter } from "node:events";
import { ZvsTui, type ZvsTuiProps } from "../../src/cli/tui/organisms/ZvsTui";
import { initialTuiState, type TuiState } from "../../src/cli/tui/state";

const ROWS = 24;
const COLUMNS = 80;

function harness() {
  const frames: string[] = [];
  const stdout = Object.assign(new EventEmitter(), {
    write: (chunk: string) => {
      frames.push(chunk);
      return true;
    },
    columns: COLUMNS,
    rows: ROWS,
    isTTY: true,
  });
  const stdin = Object.assign(new EventEmitter(), {
    isTTY: true,
    setRawMode: () => stdin,
    setEncoding: () => stdin,
    resume: () => stdin,
    pause: () => stdin,
    read: () => null,
    ref: () => stdin,
    unref: () => stdin,
  });
  return { stdout, stdin, frames };
}

function screenRows(frames: string[]): string[] {
  const frame = frames
    .slice()
    .sort((left, right) => right.length - left.length)[0];
  return (frame ?? "").replace(/\[[0-9;?]*[a-zA-Z]/g, "").split("\n");
}

/** Экранная строка (0-based), на которой отрисован текст. */
function rowOf(frames: string[], text: string): number {
  const row = screenRows(frames).findIndex((line) => line.includes(text));
  expect(row, `строка «${text}» не найдена в кадре`).toBeGreaterThanOrEqual(0);
  return row;
}

function click(stdin: EventEmitter, column: number, row: number) {
  stdin.emit("data", `[<0;${column + 1};${row + 1}M`);
}

function baseProps(overrides: Partial<ZvsTuiProps>): ZvsTuiProps {
  return {
    version: "1.0.0",
    model: "GPT-5",
    project: "ZVS",
    permission: "edit",
    recentSessions: [],
    attachments: [],
    skills: [],
    selectedSkills: [],
    onSubmit: vi.fn(),
    onQueue: vi.fn(),
    onCancel: vi.fn(),
    onExit: vi.fn(),
    onAnswer: vi.fn(),
    onMenuSelect: vi.fn(),
    onEscape: vi.fn(),
    onAttach: vi.fn(),
    onRemoveLastAttachment: vi.fn(),
    onSelectSkill: vi.fn(),
    onRemoveLastSkill: vi.fn(),
    ...overrides,
  };
}

const filledState: TuiState = {
  ...initialTuiState(),
  transcript: Array.from({ length: 40 }, (_value, index) => ({
    id: `line-${index}`,
    kind: "system" as const,
    text: `строка ленты номер ${index}`,
  })),
};

async function mount(props: ZvsTuiProps) {
  const { stdout, stdin, frames } = harness();
  const app = render(createElement(ZvsTui, props), {
    stdout: stdout as never,
    stdin: stdin as never,
    patchConsole: false,
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { app, stdin, frames };
}

describe("клики мышью по интерфейсу", () => {
  it("выбирает пункт меню, по которому кликнули", async () => {
    const onMenuSelect = vi.fn();
    const { app, stdin, frames } = await mount(
      baseProps({
        state: filledState,
        onMenuSelect,
        menu: {
          title: "Модель",
          items: [
            { label: "GPT-5", value: "gpt-5" },
            { label: "Claude Opus 5", value: "opus-5" },
            { label: "Haiku 4.5", value: "haiku" },
          ],
        },
      }),
    );

    click(stdin, 6, rowOf(frames, "Claude Opus 5"));
    expect(onMenuSelect).toHaveBeenCalledWith("opus-5");

    click(stdin, 6, rowOf(frames, "Haiku 4.5"));
    expect(onMenuSelect).toHaveBeenLastCalledWith("haiku");
    app.unmount();
  });

  it("не выбирает ничего при клике мимо списка", async () => {
    const onMenuSelect = vi.fn();
    const { app, stdin, frames } = await mount(
      baseProps({
        state: filledState,
        onMenuSelect,
        menu: {
          title: "Модель",
          items: [{ label: "GPT-5", value: "gpt-5" }],
        },
      }),
    );

    click(stdin, 6, rowOf(frames, "Модель"));
    click(stdin, 6, 0);
    expect(onMenuSelect).not.toHaveBeenCalled();
    app.unmount();
  });

  it("отвечает на вопрос кликом по варианту", async () => {
    const onAnswer = vi.fn();
    const { app, stdin, frames } = await mount(
      baseProps({
        state: {
          ...filledState,
          phase: "waiting-user",
          question: {
            id: "q1",
            runId: "r1",
            conversationId: "c1",
            header: "Куда писать",
            question: "Выберите каталог",
            multiSelect: false,
            options: [
              { label: "в проект", description: "" },
              { label: "во временную папку", description: "" },
            ],
          } as never,
        },
        onAnswer,
      }),
    );

    click(stdin, 6, rowOf(frames, "во временную папку"));
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1" }),
      ["во временную папку"],
    );
    app.unmount();
  });

  it("прокручивает ленту колесом и возвращает её вниз", async () => {
    const { app, stdin, frames } = await mount(
      baseProps({ state: filledState }),
    );
    const before = screenRows(frames).length;
    expect(before).toBeGreaterThan(0);

    stdin.emit("data", "[<64;10;5M");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screenRows(frames).join("\n")).toContain("строк от конца");

    stdin.emit("data", "[<65;10;5M");
    stdin.emit("data", "[<65;10;5M");
    await new Promise((resolve) => setTimeout(resolve, 30));
    app.unmount();
  });

  it("игнорирует мышь, когда она выключена", async () => {
    const onMenuSelect = vi.fn();
    const { app, stdin, frames } = await mount(
      baseProps({
        state: filledState,
        mouseEnabled: false,
        onMenuSelect,
        menu: {
          title: "Модель",
          items: [{ label: "GPT-5", value: "gpt-5" }],
        },
      }),
    );
    click(stdin, 6, rowOf(frames, "GPT-5"));
    expect(onMenuSelect).not.toHaveBeenCalled();
    app.unmount();
  });
});
