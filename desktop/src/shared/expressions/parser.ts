import type { BinaryOperator, Node } from "./ast";
import { ExpressionSyntaxError, tokenize, type Token } from "./tokenizer";

const MAX_SOURCE_LENGTH = 8_000;
const MAX_DEPTH = 48;

class Parser {
  private position = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  private get current(): Token {
    return this.tokens[this.position]!;
  }

  private advance(): Token {
    return this.tokens[this.position++]!;
  }

  private isPunctuator(value: string): boolean {
    return this.current.type === "punctuator" && this.current.value === value;
  }

  private eat(value: string): boolean {
    if (!this.isPunctuator(value)) return false;
    this.position += 1;
    return true;
  }

  private expect(value: string): void {
    if (!this.eat(value))
      throw new ExpressionSyntaxError(
        `Ожидалось «${value}», получено «${this.current.value || "конец выражения"}»`,
        this.current.start,
      );
  }

  private enter<T>(produce: () => T): T {
    if (++this.depth > MAX_DEPTH)
      throw new ExpressionSyntaxError(
        "Выражение слишком глубоко вложено",
        this.current.start,
      );
    try {
      return produce();
    } finally {
      this.depth -= 1;
    }
  }

  parse(): Node {
    const node = this.parseExpression();
    if (this.current.type !== "eof")
      throw new ExpressionSyntaxError(
        `Лишние символы после выражения: «${this.current.value}»`,
        this.current.start,
      );
    return node;
  }

  private parseExpression(): Node {
    return this.enter(() => this.parseConditional());
  }

  private parseConditional(): Node {
    const arrow = this.tryParseArrow();
    if (arrow) return arrow;

    const test = this.parseNullish();
    if (!this.eat("?")) return test;
    const consequent = this.parseExpression();
    this.expect(":");
    const alternate = this.parseExpression();
    return { kind: "conditional", test, consequent, alternate };
  }

  private tryParseArrow(): Node | undefined {
    const save = this.position;

    if (
      this.current.type === "identifier" &&
      this.tokens[this.position + 1]?.value === "=>"
    ) {
      const param = this.advance().value;
      this.expect("=>");
      return { kind: "arrow", params: [param], body: this.parseExpression() };
    }

    if (this.isPunctuator("(")) {
      this.position += 1;
      const params: string[] = [];
      let valid = true;
      if (!this.isPunctuator(")")) {
        for (;;) {
          if (this.current.type !== "identifier") {
            valid = false;
            break;
          }
          params.push(this.advance().value);
          if (!this.eat(",")) break;
        }
      }
      if (valid && this.eat(")") && this.eat("=>"))
        return { kind: "arrow", params, body: this.parseExpression() };
      this.position = save;
    }

    return undefined;
  }

  private parseNullish(): Node {
    let left = this.parseLogicalOr();
    while (this.isPunctuator("??")) {
      this.position += 1;
      left = {
        kind: "logical",
        operator: "??",
        left,
        right: this.parseLogicalOr(),
      };
    }
    return left;
  }

  private parseLogicalOr(): Node {
    let left = this.parseLogicalAnd();
    while (this.isPunctuator("||")) {
      this.position += 1;
      left = {
        kind: "logical",
        operator: "||",
        left,
        right: this.parseLogicalAnd(),
      };
    }
    return left;
  }

  private parseLogicalAnd(): Node {
    let left = this.parseEquality();
    while (this.isPunctuator("&&")) {
      this.position += 1;
      left = {
        kind: "logical",
        operator: "&&",
        left,
        right: this.parseEquality(),
      };
    }
    return left;
  }

  private parseEquality(): Node {
    let left = this.parseRelational();
    for (;;) {
      const operator = this.current.value;
      if (
        this.current.type === "punctuator" &&
        (operator === "===" ||
          operator === "!==" ||
          operator === "==" ||
          operator === "!=")
      ) {
        this.position += 1;
        left = {
          kind: "binary",
          operator: operator as BinaryOperator,
          left,
          right: this.parseRelational(),
        };
        continue;
      }
      return left;
    }
  }

  private parseRelational(): Node {
    let left = this.parseAdditive();
    for (;;) {
      const operator = this.current.value;
      if (
        this.current.type === "punctuator" &&
        (operator === "<" ||
          operator === ">" ||
          operator === "<=" ||
          operator === ">=")
      ) {
        this.position += 1;
        left = {
          kind: "binary",
          operator: operator as BinaryOperator,
          left,
          right: this.parseAdditive(),
        };
        continue;
      }
      return left;
    }
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    for (;;) {
      const operator = this.current.value;
      if (
        this.current.type === "punctuator" &&
        (operator === "+" || operator === "-")
      ) {
        this.position += 1;
        left = {
          kind: "binary",
          operator: operator as BinaryOperator,
          left,
          right: this.parseMultiplicative(),
        };
        continue;
      }
      return left;
    }
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    for (;;) {
      const operator = this.current.value;
      if (
        this.current.type === "punctuator" &&
        (operator === "*" || operator === "/" || operator === "%")
      ) {
        this.position += 1;
        left = {
          kind: "binary",
          operator: operator as BinaryOperator,
          left,
          right: this.parseUnary(),
        };
        continue;
      }
      return left;
    }
  }

  private parseUnary(): Node {
    const operator = this.current.value;
    if (
      this.current.type === "punctuator" &&
      (operator === "!" || operator === "-" || operator === "+")
    ) {
      this.position += 1;
      return {
        kind: "unary",
        operator: operator as "!" | "-" | "+",
        argument: this.parseUnary(),
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      if (this.isPunctuator(".")) {
        const start = this.current.start;
        this.position += 1;
        if (this.current.type !== "identifier")
          throw new ExpressionSyntaxError(
            "После точки ожидается имя свойства",
            this.current.start,
          );
        const name = this.advance().value;
        node = {
          kind: "member",
          object: node,
          property: { kind: "literal", value: name },
          computed: false,
          optional: false,
          start,
        };
        continue;
      }
      if (this.isPunctuator("?.")) {
        const start = this.current.start;
        this.position += 1;
        if (this.isPunctuator("(")) {
          this.position += 1;
          node = {
            kind: "call",
            callee: node,
            args: this.parseArguments(),
            optional: true,
            start,
          };
          continue;
        }
        if (this.isPunctuator("[")) {
          this.position += 1;
          const property = this.parseExpression();
          this.expect("]");
          node = {
            kind: "member",
            object: node,
            property,
            computed: true,
            optional: true,
            start,
          };
          continue;
        }
        if (this.current.type !== "identifier")
          throw new ExpressionSyntaxError(
            "После «?.» ожидается имя свойства",
            this.current.start,
          );
        const name = this.advance().value;
        node = {
          kind: "member",
          object: node,
          property: { kind: "literal", value: name },
          computed: false,
          optional: true,
          start,
        };
        continue;
      }
      if (this.isPunctuator("[")) {
        const start = this.current.start;
        this.position += 1;
        const property = this.parseExpression();
        this.expect("]");
        node = {
          kind: "member",
          object: node,
          property,
          computed: true,
          optional: false,
          start,
        };
        continue;
      }
      if (this.isPunctuator("(")) {
        const start = this.current.start;
        this.position += 1;
        node = {
          kind: "call",
          callee: node,
          args: this.parseArguments(),
          optional: false,
          start,
        };
        continue;
      }
      return node;
    }
  }

  private parseArguments(): Node[] {
    const args: Node[] = [];
    if (this.eat(")")) return args;
    for (;;) {
      args.push(this.parseExpression());
      if (this.eat(",")) continue;
      this.expect(")");
      return args;
    }
  }

  private parsePrimary(): Node {
    const token = this.current;

    if (token.type === "number") {
      this.position += 1;
      return { kind: "literal", value: Number(token.value) };
    }
    if (token.type === "string") {
      this.position += 1;
      return { kind: "literal", value: token.literal ?? "" };
    }
    if (token.type === "variable") {
      this.position += 1;
      return { kind: "variable", name: token.value, start: token.start };
    }
    if (token.type === "identifier") {
      this.position += 1;
      if (token.value === "true") return { kind: "literal", value: true };
      if (token.value === "false") return { kind: "literal", value: false };
      if (token.value === "null") return { kind: "literal", value: null };
      if (token.value === "undefined")
        return { kind: "literal", value: undefined };
      return { kind: "identifier", name: token.value, start: token.start };
    }
    if (this.isPunctuator("(")) {
      this.position += 1;
      const node = this.parseExpression();
      this.expect(")");
      return node;
    }
    if (this.isPunctuator("[")) {
      this.position += 1;
      const elements: Node[] = [];
      if (!this.eat("]")) {
        for (;;) {
          elements.push(this.parseExpression());
          if (this.eat(",")) {
            if (this.eat("]")) break;
            continue;
          }
          this.expect("]");
          break;
        }
      }
      return { kind: "array", elements };
    }
    if (this.isPunctuator("{")) {
      this.position += 1;
      const entries: Array<{ key: Node; computed: boolean; value: Node }> = [];
      if (!this.eat("}")) {
        for (;;) {
          let key: Node;
          let computed = false;
          if (this.isPunctuator("[")) {
            this.position += 1;
            key = this.parseExpression();
            this.expect("]");
            computed = true;
          } else if (
            this.current.type === "identifier" ||
            this.current.type === "string"
          ) {
            const keyToken = this.advance();
            key = {
              kind: "literal",
              value: keyToken.literal ?? keyToken.value,
            };
          } else if (this.current.type === "number") {
            key = { kind: "literal", value: this.advance().value };
          } else
            throw new ExpressionSyntaxError(
              "Ожидался ключ объекта",
              this.current.start,
            );
          this.expect(":");
          entries.push({ key, computed, value: this.parseExpression() });
          if (this.eat(",")) {
            if (this.eat("}")) break;
            continue;
          }
          this.expect("}");
          break;
        }
      }
      return { kind: "object", entries };
    }

    throw new ExpressionSyntaxError(
      `Неожиданный токен «${token.value || "конец выражения"}»`,
      token.start,
    );
  }
}

const cache = new Map<string, Node>();
const CACHE_LIMIT = 500;

export function parseExpression(source: string): Node {
  if (source.length > MAX_SOURCE_LENGTH)
    throw new ExpressionSyntaxError("Выражение слишком длинное", 0);
  const cached = cache.get(source);
  if (cached) return cached;
  const node = new Parser(tokenize(source)).parse();
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(source, node);
  return node;
}

export { ExpressionSyntaxError };
