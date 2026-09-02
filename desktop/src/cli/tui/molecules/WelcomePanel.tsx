import { Box, Text, useWindowSize } from "ink";
import { AsciiLogo, LOGO_COLUMNS } from "../atoms/AsciiLogo";
import { tuiColors } from "../theme";
import type { RecentChatSession } from "../../../shared/models/chat";

/** Колонки под подпись рядом с логотипом: отступ и самая длинная строка. */
const META_COLUMNS = 24;
/** Колонки под список недавних сессий. */
const SESSIONS_COLUMNS = 30;

export function WelcomePanel({
  sessions,
  version,
  model,
  project,
  mouse,
}: {
  sessions: RecentChatSession[];
  version: string;
  model: string;
  project: string;
  mouse?: boolean;
}) {
  const { columns, rows } = useWindowSize();
  const layout = welcomeLayout(columns, rows);

  return (
    <Box marginTop={1} marginLeft={2} flexDirection="column">
      <Box alignItems="center">
        {layout.logo ? (
          <Box flexShrink={0}>
            <AsciiLogo />
          </Box>
        ) : null}
        <Box
          marginLeft={layout.logo ? 2 : 0}
          flexShrink={1}
          flexDirection="column"
        >
          <Text wrap="truncate-end">
            <Text bold color={tuiColors.text}>
              ZVS Assistant
            </Text>{" "}
            <Text color={tuiColors.subtle}>v{version}</Text>
          </Text>
          <Text color={tuiColors.text} wrap="truncate-end">
            {model}
          </Text>
          <Text color={tuiColors.muted} wrap="truncate-end">
            {project}
          </Text>
        </Box>
        {layout.sessions && sessions.length ? (
          <Box marginLeft={4} flexShrink={1} flexDirection="column">
            <Text bold color={tuiColors.text}>
              Недавние сессии
            </Text>
            {sessions.slice(0, 3).map((session) => (
              <Text
                key={session.conversationId}
                color={tuiColors.muted}
                wrap="truncate-end"
              >
                <Text color={tuiColors.subtle}>› </Text>
                {session.title} · {session.project?.name ?? "без проекта"}
              </Text>
            ))}
            <Text color={tuiColors.subtle}>/resume — открыть все</Text>
          </Box>
        ) : null}
      </Box>
      {layout.hints ? (
        <Box marginTop={1} flexDirection="column">
          {[
            ["/", "команды: модель, проект, режим разрешений"],
            ["@", "контекст: @file — файл, @skill — навык"],
            ["!", "shell-команда в папке проекта"],
            mouse
              ? ["~", "мышь: колесо — лента, клик — выбор в списках"]
              : undefined,
          ]
            .filter((row): row is string[] => Boolean(row))
            .map(([key, description]) => (
              <Text key={key} color={tuiColors.muted} wrap="truncate-end">
                <Text color={tuiColors.accent}>{key}</Text>
                {"  "}
                {description}
              </Text>
            ))}
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * Что помещается на текущем экране.
 *
 * Логотип рисуется только когда рядом с ним целиком встаёт подпись: иначе она
 * переносится по словам и разрывает ASCII-арт на части. Подсказки уступают
 * место логотипу на низких терминалах — приветствие обрезается сверху, и без
 * этого у логотипа отъедало верхние строки.
 */
export function welcomeLayout(
  columns: number,
  rows: number,
): { logo: boolean; sessions: boolean; hints: boolean } {
  const logo = columns >= LOGO_COLUMNS + META_COLUMNS + 4 && rows >= 20;
  const usedColumns = (logo ? LOGO_COLUMNS + 2 : 0) + META_COLUMNS;
  return {
    logo,
    sessions: columns >= usedColumns + SESSIONS_COLUMNS + 4,
    hints: rows >= (logo ? 22 : 12),
  };
}
