export type TokenType =
  "number" | "string" | "identifier" | "variable" | "punctuator" | "eof";

export interface Token {
  type: TokenType;
  value: string;
  literal?: string;
  start: number;
  end: number;
}

export class ExpressionSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = "ExpressionSyntaxError";
  }
}

const PUNCTUATORS = [
  "===",
  "!==",
  "??",
  "?.",
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ".",
  ":",
  "?",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "!",
];

const IDENTIFIER_START = /[A-Za-z_]/;
const IDENTIFIER_PART = /[A-Za-z0-9_]/;

function isSpace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f" ||
    char === "\v"
  );
}

function readEscape(
  source: string,
  index: number,
): { value: string; next: number } {
  const char = source[index];
  switch (char) {
    case "n":
      return { value: "\n", next: index + 1 };
    case "t":
      return { value: "\t", next: index + 1 };
    case "r":
      return { value: "\r", next: index + 1 };
    case "b":
      return { value: "\b", next: index + 1 };
    case "f":
      return { value: "\f", next: index + 1 };
    case "0":
      return { value: "\0", next: index + 1 };
    case "u": {
      const hex = source.slice(index + 1, index + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex))
        throw new ExpressionSyntaxError(
          "Некорректная escape-последовательность \\u",
          index,
        );
      return {
        value: String.fromCharCode(Number.parseInt(hex, 16)),
        next: index + 5,
      };
    }
    case "x": {
      const hex = source.slice(index + 1, index + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(hex))
        throw new ExpressionSyntaxError(
          "Некорректная escape-последовательность \\x",
          index,
        );
      return {
        value: String.fromCharCode(Number.parseInt(hex, 16)),
        next: index + 3,
      };
    }
    default:
      if (char === undefined)
        throw new ExpressionSyntaxError(
          "Незакрытая escape-последовательность",
          index,
        );
      return { value: char, next: index + 1 };
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index]!;

    if (isSpace(char)) {
      index += 1;
      continue;
    }

    if (
      /[0-9]/.test(char) ||
      (char === "." && /[0-9]/.test(source[index + 1] ?? ""))
    ) {
      const start = index;
      while (index < source.length && /[0-9]/.test(source[index]!)) index += 1;
      if (source[index] === ".") {
        index += 1;
        while (index < source.length && /[0-9]/.test(source[index]!))
          index += 1;
      }
      if (source[index] === "e" || source[index] === "E") {
        const save = index;
        index += 1;
        if (source[index] === "+" || source[index] === "-") index += 1;
        if (/[0-9]/.test(source[index] ?? "")) {
          while (index < source.length && /[0-9]/.test(source[index]!))
            index += 1;
        } else index = save;
      }
      tokens.push({
        type: "number",
        value: source.slice(start, index),
        start,
        end: index,
      });
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      const start = index;
      index += 1;
      let literal = "";
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") {
          const escaped = readEscape(source, index + 1);
          literal += escaped.value;
          index = escaped.next;
        } else {
          literal += source[index];
          index += 1;
        }
      }
      if (source[index] !== quote)
        throw new ExpressionSyntaxError("Незакрытая строка", start);
      index += 1;
      tokens.push({
        type: "string",
        value: source.slice(start, index),
        literal,
        start,
        end: index,
      });
      continue;
    }

    if (char === "$") {
      const start = index;
      index += 1;
      while (index < source.length && IDENTIFIER_PART.test(source[index]!))
        index += 1;
      tokens.push({
        type: "variable",
        value: source.slice(start, index),
        start,
        end: index,
      });
      continue;
    }

    if (IDENTIFIER_START.test(char)) {
      const start = index;
      while (index < source.length && IDENTIFIER_PART.test(source[index]!))
        index += 1;
      tokens.push({
        type: "identifier",
        value: source.slice(start, index),
        start,
        end: index,
      });
      continue;
    }

    const punctuator = PUNCTUATORS.find((candidate) =>
      source.startsWith(candidate, index),
    );
    if (punctuator) {
      tokens.push({
        type: "punctuator",
        value: punctuator,
        start: index,
        end: index + punctuator.length,
      });
      index += punctuator.length;
      continue;
    }

    throw new ExpressionSyntaxError(`Неожиданный символ «${char}»`, index);
  }

  tokens.push({ type: "eof", value: "", start: index, end: index });
  return tokens;
}
