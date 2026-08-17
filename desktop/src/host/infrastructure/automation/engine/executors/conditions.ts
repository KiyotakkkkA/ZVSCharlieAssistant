import { isEmpty, toNumber, toText } from "../../../../../shared/expressions";
import type {
  ComparisonOperator,
  ConditionGroup,
  ConditionRule,
} from "../../../../../shared/scenario";

const MAX_REGEX_SOURCE = 500;

function compareNumbers(left: unknown, right: unknown): number | undefined {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return undefined;
  return leftNumber - rightNumber;
}

function equals(
  left: unknown,
  right: unknown,
  caseSensitive: boolean,
): boolean {
  if (typeof left === "boolean" || typeof right === "boolean")
    return Boolean(left) === Boolean(right);
  const numeric = compareNumbers(left, right);
  if (numeric !== undefined && left !== "" && right !== "")
    return numeric === 0;
  if (left !== null && typeof left === "object") {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }
  const leftText = toText(left);
  const rightText = toText(right);
  return caseSensitive
    ? leftText === rightText
    : leftText.toLowerCase() === rightText.toLowerCase();
}

function contains(
  haystack: unknown,
  needle: unknown,
  caseSensitive: boolean,
): boolean {
  if (Array.isArray(haystack))
    return haystack.some((item) => equals(item, needle, caseSensitive));
  const text = toText(haystack);
  const search = toText(needle);
  return caseSensitive
    ? text.includes(search)
    : text.toLowerCase().includes(search.toLowerCase());
}

export function evaluateCondition(rule: ConditionRule): boolean {
  const { left, right, operator, caseSensitive } = rule;
  const sensitive = Boolean(caseSensitive);

  switch (operator as ComparisonOperator) {
    case "equals":
      return equals(left, right, sensitive);
    case "notEquals":
      return !equals(left, right, sensitive);
    case "contains":
      return contains(left, right, sensitive);
    case "notContains":
      return !contains(left, right, sensitive);
    case "startsWith":
      return sensitive
        ? toText(left).startsWith(toText(right))
        : toText(left).toLowerCase().startsWith(toText(right).toLowerCase());
    case "endsWith":
      return sensitive
        ? toText(left).endsWith(toText(right))
        : toText(left).toLowerCase().endsWith(toText(right).toLowerCase());
    case "gt":
      return (compareNumbers(left, right) ?? compareText(left, right)) > 0;
    case "gte":
      return (compareNumbers(left, right) ?? compareText(left, right)) >= 0;
    case "lt":
      return (compareNumbers(left, right) ?? compareText(left, right)) < 0;
    case "lte":
      return (compareNumbers(left, right) ?? compareText(left, right)) <= 0;
    case "isEmpty":
      return isEmpty(left);
    case "isNotEmpty":
      return !isEmpty(left);
    case "isTrue":
      return (
        left === true ||
        toText(left).toLowerCase() === "true" ||
        toNumber(left) === 1
      );
    case "isFalse":
      return !(
        left === true ||
        toText(left).toLowerCase() === "true" ||
        toNumber(left) === 1
      );
    case "in": {
      const list = Array.isArray(right)
        ? right
        : toText(right)
            .split(",")
            .map((entry) => entry.trim());
      return list.some((entry) => equals(left, entry, sensitive));
    }
    case "regex":
      return matchesRegex(toText(left), toText(right), sensitive);
    default:
      return false;
  }
}

function compareText(left: unknown, right: unknown): number {
  const leftText = toText(left);
  const rightText = toText(right);
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

function matchesRegex(
  value: string,
  pattern: string,
  caseSensitive: boolean,
): boolean {
  if (!pattern || pattern.length > MAX_REGEX_SOURCE) return false;
  try {
    return new RegExp(pattern, caseSensitive ? "" : "i").test(value);
  } catch {
    return false;
  }
}

export function evaluateGroup(group: ConditionGroup): boolean {
  const conditions = group.conditions ?? [];
  if (conditions.length === 0) return true;
  return group.combinator === "or"
    ? conditions.some((condition) => evaluateCondition(condition))
    : conditions.every((condition) => evaluateCondition(condition));
}
