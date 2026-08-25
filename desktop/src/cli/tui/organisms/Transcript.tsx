import { Box } from "ink";
import type { TranscriptEntry } from "../state";
import { ContentBlock } from "../molecules/ContentBlock";

export function Transcript({ entries }: { entries: TranscriptEntry[] }) {
  return (
    <Box flexDirection="column">
      {entries.map((entry) => <ContentBlock key={entry.id} entry={entry} />)}
    </Box>
  );
}
