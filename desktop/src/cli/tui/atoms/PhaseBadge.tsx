import { Text } from "ink";
import type { TuiPhase } from "../state";
import { tuiColors } from "../theme";

const labels: Record<TuiPhase, string> = {
  idle: "готов",
  running: "работает",
  "waiting-user": "ждёт ответа",
  cancelling: "отмена",
  failed: "ошибка",
  completed: "готово",
};

export function PhaseBadge({ phase }: { phase: TuiPhase }) {
  const color =
    phase === "failed"
      ? tuiColors.danger
      : phase === "waiting-user"
        ? tuiColors.warning
        : phase === "running" || phase === "cancelling"
          ? tuiColors.accent
          : tuiColors.muted;
  return (
    <Text bold color={color}>
      {labels[phase]}
    </Text>
  );
}
