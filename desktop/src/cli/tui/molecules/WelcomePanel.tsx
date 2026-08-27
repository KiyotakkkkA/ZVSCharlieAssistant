import { Box, Text } from "ink";
import { AsciiLogo } from "../atoms/AsciiLogo";
import { tuiColors } from "../theme";
import type { RecentChatSession } from "../../../shared/models/chat";

export function WelcomePanel({ sessions }: { sessions: RecentChatSession[] }) {
  return (
    <Box marginTop={1} marginLeft={2} alignItems="center">
      <AsciiLogo />
      <Box marginLeft={3} flexDirection="column">
        <Text bold>ZVS Assistant</Text>
        <Text color={tuiColors.muted}>Ваш консольный помощник</Text>
        <Text color={tuiColors.muted}>Введите задачу или /help</Text>
        {sessions.length ? (
          <Box marginTop={1} flexDirection="column">
            <Text color={tuiColors.muted}>Последние сессии · /resume</Text>
            {sessions.slice(0, 5).map((session, index) => (
              <Text key={session.conversationId} color={tuiColors.muted}>
                {index + 1}. {session.title} ·{" "}
                {session.project?.name ?? "без проекта"}
              </Text>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
