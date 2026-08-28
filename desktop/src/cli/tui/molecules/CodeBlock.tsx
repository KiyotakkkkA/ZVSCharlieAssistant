import { Box, Text } from "ink";
import {
  highlightCode,
  normalizeCodeLanguage,
  type SyntaxTokenKind,
} from "../syntax-highlighting";
import { tuiColors } from "../theme";

export function CodeBlock({
  lines,
  language,
}: {
  lines: string[];
  language?: string;
}) {
  const normalized = normalizeCodeLanguage(language);
  const highlighted = highlightCode(lines.join("\n"), normalized);
  const label = normalized === "diff" ? "diff" : highlighted.language;
  const lineNumberWidth = String(
    Math.max(1, normalized === "diff" ? lines.length : highlighted.lines.length),
  ).length;

  return (
    <Box flexDirection="column">
      <Text color={tuiColors.subtle}>┌─ {label}</Text>
      {normalized === "diff"
        ? lines.map((line, index) => <DiffLine key={index} line={line} />)
        : highlighted.lines.map((line, index) => (
            <Box key={index}>
              <Text color={tuiColors.subtle}>
                │ {String(index + 1).padStart(lineNumberWidth)}{" "}
              </Text>
              <Text>
                {line.map((token, tokenIndex) => (
                  <Text
                    key={`${tokenIndex}:${token.text}`}
                    color={TOKEN_COLORS[token.kind]}
                    bold={token.kind === "keyword"}
                  >
                    {token.text}
                  </Text>
                ))}
              </Text>
            </Box>
          ))}
      <Text color={tuiColors.subtle}>└────</Text>
    </Box>
  );
}

function DiffLine({ line }: { line: string }) {
  const style = diffStyle(line);
  return (
    <Box backgroundColor={style.background}>
      <Text color={tuiColors.subtle} backgroundColor={style.background}>
        │{" "}
      </Text>
      <Text
        color={style.color}
        backgroundColor={style.background}
        bold={style.bold}
      >
        {line || " "}
      </Text>
    </Box>
  );
}

function diffStyle(line: string): {
  color: string;
  background?: string;
  bold?: boolean;
} {
  if (line.startsWith("+++ ") || line.startsWith("--- "))
    return { color: tuiColors.cyan, bold: true };
  if (line.startsWith("@@")) return { color: tuiColors.violet, bold: true };
  if (line.startsWith("+"))
    return { color: tuiColors.diffAdded, background: tuiColors.diffAddedBg };
  if (line.startsWith("-"))
    return {
      color: tuiColors.diffRemoved,
      background: tuiColors.diffRemovedBg,
    };
  return { color: tuiColors.text };
}

const TOKEN_COLORS: Record<SyntaxTokenKind, string> = {
  plain: tuiColors.text,
  comment: tuiColors.muted,
  keyword: tuiColors.syntaxKeyword,
  string: tuiColors.syntaxString,
  number: tuiColors.syntaxNumber,
  type: tuiColors.syntaxType,
  function: tuiColors.syntaxFunction,
  variable: tuiColors.syntaxVariable,
  meta: tuiColors.syntaxMeta,
  operator: tuiColors.syntaxOperator,
  punctuation: tuiColors.muted,
};
