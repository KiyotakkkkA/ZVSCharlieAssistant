import { Box, Text } from "ink";
import { InlineMarkup } from "../atoms/InlineMarkup";
import { tuiColors } from "../theme";
import { CodeBlock } from "./CodeBlock";

export type RichContentSegment =
  | { kind: "line"; text: string }
  | { kind: "code"; language: string; lines: string[] };

export function RichContent({
  content,
  muted = false,
}: {
  content: string;
  muted?: boolean;
}) {
  return (
    <Box flexDirection="column">
      {segmentRichContent(content).map((segment, index) =>
        segment.kind === "code" ? (
          <CodeBlock
            key={index}
            lines={segment.lines}
            language={segment.language}
          />
        ) : (
          <RichLine key={index} line={segment.text} muted={muted} />
        ),
      )}
    </Box>
  );
}

export function segmentRichContent(content: string): RichContentSegment[] {
  const source = content.split(/\r?\n/);
  const segments: RichContentSegment[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const line = source[index] ?? "";
    const fence = line.match(/^\s*```\s*([^\s`]*)?.*$/);
    if (!fence) {
      segments.push({ kind: "line", text: line });
      continue;
    }
    const lines: string[] = [];
    let cursor = index + 1;
    while (
      cursor < source.length &&
      !/^\s*```\s*$/.test(source[cursor] ?? "")
    ) {
      lines.push(source[cursor] ?? "");
      cursor += 1;
    }
    segments.push({
      kind: "code",
      language: fence[1] ?? "",
      lines,
    });
    index = cursor < source.length ? cursor : source.length - 1;
  }
  return segments;
}

function RichLine({ line, muted }: { line: string; muted: boolean }) {
  const color = muted ? tuiColors.muted : tuiColors.text;
  const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
  if (bullet)
    return (
      <Text color={color}>
        {" "}• <InlineMarkup>{bullet[1] ?? ""}</InlineMarkup>
      </Text>
    );
  const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
  if (ordered)
    return (
      <Text color={color}>
        {" "}{ordered[1]}. <InlineMarkup>{ordered[2] ?? ""}</InlineMarkup>
      </Text>
    );
  const heading = line.match(/^\s*#{1,3}\s+(.+)$/);
  if (heading)
    return (
      <Text bold color={tuiColors.text}>
        {heading[1]}
      </Text>
    );
  return (
    <Text color={color}>
      <InlineMarkup>{line}</InlineMarkup>
    </Text>
  );
}
