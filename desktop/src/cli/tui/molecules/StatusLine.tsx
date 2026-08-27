import { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import { Spinner } from "../atoms/Spinner";
import type { TuiPhase } from "../state";
import { tuiColors } from "../theme";

const VERBS = [
  "Думаю",
  "Соображаю",
  "Копаю",
  "Собираю мысли",
  "Прикидываю",
  "Мозгую",
  "Кручу шестерёнки",
  "Настраиваюсь",
  "Ищу решение",
  "Взвешиваю",
];

function pickVerb(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1)
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return VERBS[hash % VERBS.length]!;
}

export function StatusLine(props: {
  phase: TuiPhase;
  seed: string;
  startedAt?: number;
  queued: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const verb = useMemo(() => pickVerb(props.seed), [props.seed]);
  const elapsedSeconds = Math.max(
    0,
    Math.round((now - (props.startedAt ?? now)) / 1000),
  );
  const cancelling = props.phase === "cancelling";
  return (
    <Box marginTop={1}>
      <Spinner color={cancelling ? tuiColors.warning : tuiColors.accent} />
      <Text color={cancelling ? tuiColors.warning : tuiColors.text}>
        {" "}
        {cancelling ? "Останавливаю" : verb}…{" "}
      </Text>
      <Text color={tuiColors.muted}>
        ({elapsedSeconds}s
        {props.queued > 0 ? ` · в очереди ${props.queued}` : ""}
        {cancelling ? "" : " · esc — прервать"})
      </Text>
    </Box>
  );
}
