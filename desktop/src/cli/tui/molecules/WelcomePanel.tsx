import { Box, Text } from "ink";
import { AsciiLogo } from "../atoms/AsciiLogo";
import { tuiColors } from "../theme";
import type { RecentChatSession } from "../../../shared/models/chat";

export function WelcomePanel({
  sessions,
  version,
  model,
  project,
}: {
  sessions: RecentChatSession[];
  version: string;
  model: string;
  project: string;
}) {
  return (
    <Box marginTop={1} marginLeft={2} alignItems="center">
      <AsciiLogo />
      <Box marginLeft={2} flexDirection="column">
        <Text>
          <Text bold color={tuiColors.text}>ZVS Assistant</Text>{" "}
          <Text color={tuiColors.muted}>v{version}</Text>
        </Text>
        <Text color={tuiColors.text}>{model}</Text>
        <Text color={tuiColors.muted}>{project}</Text>
      </Box>
      {sessions.length ? (
        <Box marginLeft={4} flexDirection="column">
          <Text bold color={tuiColors.text}>Недавние сессии</Text>
          {sessions.slice(0, 3).map((session) => (
            <Text key={session.conversationId} color={tuiColors.muted}>
              <Text color={tuiColors.subtle}>› </Text>
              {session.title} · {session.project?.name ?? "без проекта"}
            </Text>
          ))}
          <Text color={tuiColors.subtle}>/resume — открыть все</Text>
        </Box>
      ) : null}
    </Box>
  );
}
