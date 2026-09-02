import powershell from "highlight.js/lib/languages/powershell";
import { common, createLowlight } from "lowlight";

export type SyntaxTokenKind =
  | "plain"
  | "comment"
  | "keyword"
  | "string"
  | "number"
  | "type"
  | "function"
  | "variable"
  | "meta"
  | "operator"
  | "punctuation";

export interface SyntaxToken {
  text: string;
  kind: SyntaxTokenKind;
}

export interface HighlightedCode {
  language: string;
  lines: SyntaxToken[][];
}

const highlighter = createLowlight(common);
highlighter.register({ powershell });
type HighlightNode = ReturnType<
  typeof highlighter.highlight
>["children"][number];

const LANGUAGE_ALIASES: Record<string, string> = {
  bat: "dos",
  cmd: "dos",
  cjs: "javascript",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  ps1: "powershell",
  pwsh: "powershell",
  py: "python",
  sh: "bash",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml",
  zsh: "bash",
};

const AUTO_LANGUAGES = [
  "bash",
  "cpp",
  "csharp",
  "css",
  "diff",
  "java",
  "javascript",
  "json",
  "kotlin",
  "php",
  "powershell",
  "python",
  "rust",
  "sql",
  "typescript",
  "xml",
  "yaml",
].filter((language) => highlighter.registered(language));

export function normalizeCodeLanguage(language?: string): string {
  const normalized = (language ?? "").trim().toLocaleLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

export function highlightCode(
  code: string,
  requestedLanguage?: string,
): HighlightedCode {
  const requested = normalizeCodeLanguage(requestedLanguage);
  const tree =
    requested && highlighter.registered(requested)
      ? highlighter.highlight(requested, code)
      : requested
        ? undefined
        : highlighter.highlightAuto(code, { subset: AUTO_LANGUAGES });
  if (!tree || tree.children.length === 0)
    return {
      language: requested || "text",
      lines: plainLines(code),
    };

  const lines: SyntaxToken[][] = [[]];
  for (const node of tree.children) appendNode(node, [], lines);
  return {
    language: requested || tree.data?.language || "text",
    lines: lines.map((line) =>
      line.length ? line : [{ text: "", kind: "plain" }],
    ),
  };
}

function appendNode(
  node: HighlightNode,
  inheritedClasses: string[],
  lines: SyntaxToken[][],
): void {
  if (node.type === "text") {
    appendText(node.value, tokenKind(inheritedClasses), lines);
    return;
  }
  if (node.type !== "element") return;
  const classes = [...inheritedClasses, ...classNames(node)];
  for (const child of node.children) appendNode(child, classes, lines);
}

function appendText(
  value: string,
  kind: SyntaxTokenKind,
  lines: SyntaxToken[][],
): void {
  const chunks = value.split("\n");
  chunks.forEach((chunk, index) => {
    if (index > 0) lines.push([]);
    if (!chunk) return;
    const line = lines.at(-1)!;
    const previous = line.at(-1);
    if (previous?.kind === kind) previous.text += chunk;
    else line.push({ text: chunk, kind });
  });
}

function classNames(
  node: Extract<HighlightNode, { type: "element" }>,
): string[] {
  const value = node.properties.className;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function tokenKind(classes: string[]): SyntaxTokenKind {
  const scopes = new Set(
    classes.map((value) => value.replace(/^hljs-/, "").toLocaleLowerCase()),
  );
  if (scopes.has("comment") || scopes.has("quote")) return "comment";
  if (scopes.has("meta") || scopes.has("doctag")) return "meta";
  if (
    scopes.has("keyword") ||
    scopes.has("selector-tag") ||
    scopes.has("section")
  )
    return "keyword";
  if (
    scopes.has("string") ||
    scopes.has("regexp") ||
    scopes.has("template-tag") ||
    scopes.has("template-variable")
  )
    return "string";
  if (scopes.has("number") || scopes.has("literal")) return "number";
  if (
    scopes.has("title") &&
    (scopes.has("function_") || scopes.has("function"))
  )
    return "function";
  if (
    scopes.has("type") ||
    scopes.has("class") ||
    scopes.has("class_") ||
    scopes.has("title.class_") ||
    scopes.has("built_in") ||
    scopes.has("attr") ||
    scopes.has("attribute")
  )
    return "type";
  if (
    scopes.has("variable") ||
    scopes.has("params") ||
    scopes.has("property")
  )
    return "variable";
  if (scopes.has("operator")) return "operator";
  if (scopes.has("punctuation") || scopes.has("symbol"))
    return "punctuation";
  return "plain";
}

function plainLines(code: string): SyntaxToken[][] {
  return code
    .split("\n")
    .map((line) => [{ text: line, kind: "plain" as const }]);
}
