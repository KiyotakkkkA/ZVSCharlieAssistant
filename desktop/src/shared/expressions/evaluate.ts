import type { Node } from "./ast";
import { parseExpression } from "./parser";
import {
  ExpressionRuntimeError,
  GLOBAL_FUNCTIONS,
  isCallable,
  isPlainObject,
  lookupMethod,
  toNumber,
  toText,
} from "./functions";

export interface ExpressionScope {
  $json?: unknown;
  $item?: unknown;
  $index?: number;
  $items?: unknown;
  $node?: Record<string, unknown>;
  $trigger?: unknown;
  $run?: unknown;
  $vars?: Record<string, unknown>;
  $binary?: unknown;
}

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_STEPS = 200_000;

class Frame {
  constructor(
    private readonly locals: Map<string, unknown>,
    private readonly parent?: Frame,
  ) {}

  lookup(name: string): { found: boolean; value?: unknown } {
    if (this.locals.has(name))
      return { found: true, value: this.locals.get(name) };
    return this.parent ? this.parent.lookup(name) : { found: false };
  }

  extend(names: string[], values: unknown[]): Frame {
    const locals = new Map<string, unknown>();
    names.forEach((name, index) => locals.set(name, values[index]));
    return new Frame(locals, this);
  }
}

class Interpreter {
  private steps = 0;

  constructor(private readonly scope: ExpressionScope) {}

  private tick(): void {
    if (++this.steps > MAX_STEPS)
      throw new ExpressionRuntimeError(
        "Выражение выполняется слишком долго и было прервано",
      );
  }

  run(node: Node, frame: Frame): unknown {
    this.tick();
    switch (node.kind) {
      case "literal":
        return node.value;

      case "variable": {
        const local = frame.lookup(node.name);
        if (local.found) return local.value;
        if (node.name in this.scope)
          return this.scope[node.name as keyof ExpressionScope];
        const global = GLOBAL_FUNCTIONS[node.name];
        if (global) return global;
        throw new ExpressionRuntimeError(
          `Неизвестная переменная «${node.name}»`,
        );
      }

      case "identifier": {
        const local = frame.lookup(node.name);
        if (local.found) return local.value;
        throw new ExpressionRuntimeError(
          `Неизвестное имя «${node.name}». Переменные контекста начинаются с «$»`,
        );
      }

      case "array":
        return node.elements.map((element) => this.run(element, frame));

      case "object": {
        const result: Record<string, unknown> = {};
        for (const entry of node.entries) {
          const key = toText(this.run(entry.key, frame));
          if (BLOCKED_KEYS.has(key)) continue;
          result[key] = this.run(entry.value, frame);
        }
        return result;
      }

      case "member": {
        const target = this.run(node.object, frame);
        if (node.optional && (target === null || target === undefined))
          return undefined;
        const key = node.computed
          ? this.run(node.property, frame)
          : (node.property as { value: string }).value;
        return this.member(target, key);
      }

      case "call": {
        const callee = this.run(node.callee, frame);
        if (node.optional && (callee === null || callee === undefined))
          return undefined;
        if (!isCallable(callee))
          throw new ExpressionRuntimeError(
            "Попытка вызвать значение, которое не является функцией",
          );
        const args = node.args.map((argument) => this.run(argument, frame));
        return callee(args);
      }

      case "unary": {
        const value = this.run(node.argument, frame);
        if (node.operator === "!") return !value;
        if (node.operator === "-") return -toNumber(value);
        return toNumber(value);
      }

      case "logical": {
        const left = this.run(node.left, frame);
        if (node.operator === "&&")
          return left ? this.run(node.right, frame) : left;
        if (node.operator === "||")
          return left ? left : this.run(node.right, frame);
        return left === null || left === undefined
          ? this.run(node.right, frame)
          : left;
      }

      case "conditional":
        return this.run(node.test, frame)
          ? this.run(node.consequent, frame)
          : this.run(node.alternate, frame);

      case "binary":
        return this.binary(
          node.operator,
          this.run(node.left, frame),
          this.run(node.right, frame),
        );

      case "arrow": {
        const params = node.params;
        const body = node.body;
        return (args: unknown[]) => this.run(body, frame.extend(params, args));
      }

      default: {
        const exhaustive: never = node;
        throw new ExpressionRuntimeError(
          `Неподдерживаемый узел выражения: ${JSON.stringify(exhaustive)}`,
        );
      }
    }
  }

  private member(target: unknown, rawKey: unknown): unknown {
    if (target === null || target === undefined) return undefined;
    const key = typeof rawKey === "number" ? String(rawKey) : toText(rawKey);
    if (BLOCKED_KEYS.has(key)) return undefined;

    if (Array.isArray(target)) {
      if (key === "length") return target.length;
      const index = Number(key);
      if (Number.isInteger(index))
        return target[index < 0 ? target.length + index : index];
      return lookupMethod(target, key);
    }

    if (typeof target === "string") {
      if (key === "length") return target.length;
      const index = Number(key);
      if (Number.isInteger(index))
        return target[index < 0 ? target.length + index : index];
      return lookupMethod(target, key);
    }

    if (isPlainObject(target)) {
      if (Object.hasOwn(target, key)) return target[key];
      return lookupMethod(target, key);
    }

    return lookupMethod(target, key);
  }

  private binary(operator: string, left: unknown, right: unknown): unknown {
    switch (operator) {
      case "+":
        if (typeof left === "string" || typeof right === "string")
          return toText(left) + toText(right);
        return toNumber(left) + toNumber(right);
      case "-":
        return toNumber(left) - toNumber(right);
      case "*":
        return toNumber(left) * toNumber(right);
      case "/":
        return toNumber(left) / toNumber(right);
      case "%":
        return toNumber(left) % toNumber(right);
      case "===":
        return strictEquals(left, right);
      case "!==":
        return !strictEquals(left, right);
      case "==":
        return looseEquals(left, right);
      case "!=":
        return !looseEquals(left, right);
      case "<":
        return compareValues(left, right) < 0;
      case ">":
        return compareValues(left, right) > 0;
      case "<=":
        return compareValues(left, right) <= 0;
      case ">=":
        return compareValues(left, right) >= 0;
      default:
        throw new ExpressionRuntimeError(`Неизвестный оператор «${operator}»`);
    }
  }
}

function strictEquals(left: unknown, right: unknown): boolean {
  if (
    isPlainObject(left) ||
    Array.isArray(left) ||
    isPlainObject(right) ||
    Array.isArray(right)
  ) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }
  return left === right;
}

function looseEquals(left: unknown, right: unknown): boolean {
  if (left === null || left === undefined)
    return right === null || right === undefined;
  if (right === null || right === undefined) return false;
  if (typeof left === "number" || typeof right === "number") {
    const leftNumber = toNumber(left);
    const rightNumber = toNumber(right);
    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber))
      return leftNumber === rightNumber;
  }
  if (typeof left === "boolean" || typeof right === "boolean")
    return Boolean(left) === Boolean(right);
  if (isPlainObject(left) || Array.isArray(left))
    return strictEquals(left, right);
  return toText(left) === toText(right);
}

function compareValues(left: unknown, right: unknown): number {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber))
    return leftNumber - rightNumber;
  const leftText = toText(left);
  const rightText = toText(right);
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

export function evaluateExpression(
  source: string,
  scope: ExpressionScope,
): unknown {
  const ast = parseExpression(source);
  return new Interpreter(scope).run(ast, new Frame(new Map()));
}

export { ExpressionRuntimeError };
