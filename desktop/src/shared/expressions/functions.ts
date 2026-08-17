export class ExpressionRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionRuntimeError";
  }
}

export type Callable = (args: unknown[]) => unknown;

export function isCallable(value: unknown): value is Callable {
  return typeof value === "function";
}

function fail(message: string): never {
  throw new ExpressionRuntimeError(message);
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (normalized === "") return Number.NaN;
    return Number(normalized);
  }
  if (value instanceof Date) return value.getTime();
  return Number.NaN;
}

export function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
      fail(`Не удалось разобрать дату «${value}»`);
    return parsed;
  }
  fail("Ожидалась дата");
}

const PAD = (value: number, length = 2): string =>
  String(value).padStart(length, "0");

export function formatDate(
  value: unknown,
  pattern = "YYYY-MM-DD HH:mm:ss",
): string {
  const date = toDate(value);
  const replacements: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: PAD(date.getFullYear() % 100),
    MM: PAD(date.getMonth() + 1),
    DD: PAD(date.getDate()),
    HH: PAD(date.getHours()),
    mm: PAD(date.getMinutes()),
    ss: PAD(date.getSeconds()),
    SSS: PAD(date.getMilliseconds(), 3),
  };
  return pattern.replace(
    /YYYY|YY|MM|DD|HH|mm|ss|SSS/g,
    (token) => replacements[token] ?? token,
  );
}

export function getPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of String(path).split(".")) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index)
        ? current[index < 0 ? current.length + index : index]
        : undefined;
      continue;
    }
    if (isPlainObject(current)) {
      if (
        segment === "__proto__" ||
        segment === "constructor" ||
        segment === "prototype"
      )
        return undefined;
      current = current[segment];
      continue;
    }
    return undefined;
  }
  return current;
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number")
    return left - right;
  const leftText = toText(left);
  const rightText = toText(right);
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

type MethodTable = Record<string, (self: never, args: unknown[]) => unknown>;

export const STRING_METHODS: MethodTable = {
  toUpperCase: (self: string) => self.toUpperCase(),
  toLowerCase: (self: string) => self.toLowerCase(),
  trim: (self: string) => self.trim(),
  trimStart: (self: string) => self.trimStart(),
  trimEnd: (self: string) => self.trimEnd(),
  split: (self: string, [separator, limit]) =>
    self.split(
      toText(separator ?? ""),
      limit === undefined ? undefined : toNumber(limit),
    ),
  slice: (self: string, [start, end]) =>
    self.slice(
      toNumber(start ?? 0),
      end === undefined ? undefined : toNumber(end),
    ),
  substring: (self: string, [start, end]) =>
    self.substring(
      toNumber(start ?? 0),
      end === undefined ? undefined : toNumber(end),
    ),
  includes: (self: string, [search]) => self.includes(toText(search)),
  startsWith: (self: string, [search]) => self.startsWith(toText(search)),
  endsWith: (self: string, [search]) => self.endsWith(toText(search)),
  indexOf: (self: string, [search]) => self.indexOf(toText(search)),
  lastIndexOf: (self: string, [search]) => self.lastIndexOf(toText(search)),
  replace: (self: string, [search, replacement]) =>
    self.replace(toText(search), toText(replacement)),
  replaceAll: (self: string, [search, replacement]) =>
    self.replaceAll(toText(search), toText(replacement)),
  padStart: (self: string, [length, filler]) =>
    self.padStart(toNumber(length), toText(filler ?? " ")),
  padEnd: (self: string, [length, filler]) =>
    self.padEnd(toNumber(length), toText(filler ?? " ")),
  repeat: (self: string, [count]) =>
    self.repeat(Math.min(1_000, Math.max(0, toNumber(count)))),
  charAt: (self: string, [index]) => self.charAt(toNumber(index)),
  at: (self: string, [index]) => self.at(toNumber(index)),
  concat: (self: string, args) => self + args.map(toText).join(""),
  toNumber: (self: string) => toNumber(self),
  toJson: (self: string) => {
    try {
      return JSON.parse(self) as unknown;
    } catch {
      fail("Строка не является корректным JSON");
    }
  },
  length: (self: string) => self.length,
};

function callback(value: unknown, name: string): Callable {
  if (!isCallable(value))
    fail(`Метод ${name} ожидает функцию первым аргументом`);
  return value;
}

export const ARRAY_METHODS: MethodTable = {
  map: (self: unknown[], [fn]) =>
    self.map((item, index) => callback(fn, "map")([item, index])),
  filter: (self: unknown[], [fn]) =>
    self.filter((item, index) =>
      Boolean(callback(fn, "filter")([item, index])),
    ),
  find: (self: unknown[], [fn]) =>
    self.find((item, index) => Boolean(callback(fn, "find")([item, index]))),
  findIndex: (self: unknown[], [fn]) =>
    self.findIndex((item, index) =>
      Boolean(callback(fn, "findIndex")([item, index])),
    ),
  some: (self: unknown[], [fn]) =>
    self.some((item, index) => Boolean(callback(fn, "some")([item, index]))),
  every: (self: unknown[], [fn]) =>
    self.every((item, index) => Boolean(callback(fn, "every")([item, index]))),
  reduce: (self: unknown[], [fn, initial]) =>
    self.reduce(
      (accumulator, item, index) =>
        callback(fn, "reduce")([accumulator, item, index]),
      initial,
    ),
  sort: (self: unknown[], [fn]) =>
    [...self].sort(
      isCallable(fn)
        ? (left, right) => toNumber(fn([left, right]))
        : (left, right) => compare(left, right),
    ),
  sortBy: (self: unknown[], [key]) =>
    [...self].sort((left, right) =>
      compare(getPath(left, toText(key)), getPath(right, toText(key))),
    ),
  reverse: (self: unknown[]) => [...self].reverse(),
  slice: (self: unknown[], [start, end]) =>
    self.slice(
      toNumber(start ?? 0),
      end === undefined ? undefined : toNumber(end),
    ),
  join: (self: unknown[], [separator]) =>
    self.map(toText).join(toText(separator ?? ",")),
  includes: (self: unknown[], [value]) => self.includes(value),
  indexOf: (self: unknown[], [value]) => self.indexOf(value),
  at: (self: unknown[], [index]) => self.at(toNumber(index)),
  first: (self: unknown[]) => self[0],
  last: (self: unknown[]) => self.at(-1),
  concat: (self: unknown[], args) =>
    self.concat(...args.map((item) => (Array.isArray(item) ? item : [item]))),
  flat: (self: unknown[], [depth]) =>
    self.flat(Math.min(8, Math.max(1, toNumber(depth ?? 1)))) as unknown[],
  unique: (self: unknown[]) =>
    [
      ...new Set(
        self.map((item) =>
          isPlainObject(item) || Array.isArray(item)
            ? JSON.stringify(item)
            : item,
        ),
      ),
    ].map((marker) =>
      typeof marker === "string" &&
      (marker.startsWith("{") || marker.startsWith("["))
        ? (JSON.parse(marker) as unknown)
        : marker,
    ),
  compact: (self: unknown[]) => self.filter((item) => !isEmpty(item)),
  pluck: (self: unknown[], [key]) =>
    self.map((item) => getPath(item, toText(key))),
  sum: (self: unknown[]) =>
    self.reduce((total: number, item) => total + toNumber(item), 0),
  avg: (self: unknown[]) =>
    self.length === 0
      ? 0
      : self.reduce((total: number, item) => total + toNumber(item), 0) /
        self.length,
  min: (self: unknown[]) =>
    self.length === 0
      ? undefined
      : self.reduce((best, item) => (compare(item, best) < 0 ? item : best)),
  max: (self: unknown[]) =>
    self.length === 0
      ? undefined
      : self.reduce((best, item) => (compare(item, best) > 0 ? item : best)),
  chunk: (self: unknown[], [size]) => {
    const step = Math.max(1, Math.min(10_000, toNumber(size)));
    const result: unknown[][] = [];
    for (let index = 0; index < self.length; index += step)
      result.push(self.slice(index, index + step));
    return result;
  },
  groupBy: (self: unknown[], [key]) => {
    const result: Record<string, unknown[]> = {};
    for (const item of self) {
      const groupKey = toText(
        isCallable(key) ? key([item]) : getPath(item, toText(key)),
      );
      (result[groupKey] ??= []).push(item);
    }
    return result;
  },
  length: (self: unknown[]) => self.length,
};

export const OBJECT_METHODS: MethodTable = {
  keys: (self: Record<string, unknown>) => Object.keys(self),
  values: (self: Record<string, unknown>) => Object.values(self),
  entries: (self: Record<string, unknown>) =>
    Object.entries(self).map(([key, value]) => ({ key, value })),
  get: (self: Record<string, unknown>, [path, fallback]) => {
    const value = getPath(self, toText(path));
    return value === undefined ? fallback : value;
  },
  has: (self: Record<string, unknown>, [path]) =>
    getPath(self, toText(path)) !== undefined,
  merge: (self: Record<string, unknown>, args) => {
    const result: Record<string, unknown> = { ...self };
    for (const patch of args)
      if (isPlainObject(patch)) Object.assign(result, patch);
    return result;
  },
  pick: (self: Record<string, unknown>, args) => {
    const names = args
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .map(toText);
    const result: Record<string, unknown> = {};
    for (const name of names) if (name in self) result[name] = self[name];
    return result;
  },
  omit: (self: Record<string, unknown>, args) => {
    const names = new Set(
      args.flatMap((item) => (Array.isArray(item) ? item : [item])).map(toText),
    );
    return Object.fromEntries(
      Object.entries(self).filter(([key]) => !names.has(key)),
    );
  },
  toJson: (self: Record<string, unknown>) => JSON.stringify(self),
};

export const NUMBER_METHODS: MethodTable = {
  toFixed: (self: number, [digits]) =>
    self.toFixed(Math.min(20, Math.max(0, toNumber(digits ?? 0)))),
  toString: (self: number) => String(self),
  round: (self: number) => Math.round(self),
  floor: (self: number) => Math.floor(self),
  ceil: (self: number) => Math.ceil(self),
  abs: (self: number) => Math.abs(self),
};

export const GLOBAL_FUNCTIONS: Record<string, Callable> = {
  $if: ([condition, whenTrue, whenFalse]) => (condition ? whenTrue : whenFalse),
  $default: ([value, fallback]) => (isEmpty(value) ? fallback : value),
  $isEmpty: ([value]) => isEmpty(value),
  $isNotEmpty: ([value]) => !isEmpty(value),
  $toNumber: ([value]) => toNumber(value),
  $toString: ([value]) => toText(value),
  $toBoolean: ([value]) => Boolean(value) && value !== "false" && value !== "0",
  $parseJson: ([value]) => {
    try {
      return JSON.parse(toText(value)) as unknown;
    } catch {
      fail("Значение не является корректным JSON");
    }
  },
  $stringify: ([value, indent]) =>
    JSON.stringify(
      value,
      null,
      indent === undefined ? undefined : toNumber(indent),
    ),
  $len: ([value]) =>
    typeof value === "string" || Array.isArray(value)
      ? value.length
      : isPlainObject(value)
        ? Object.keys(value).length
        : 0,
  $keys: ([value]) => (isPlainObject(value) ? Object.keys(value) : []),
  $values: ([value]) => (isPlainObject(value) ? Object.values(value) : []),
  $upper: ([value]) => toText(value).toUpperCase(),
  $lower: ([value]) => toText(value).toLowerCase(),
  $trim: ([value]) => toText(value).trim(),
  $round: ([value, digits]) => {
    const factor = 10 ** Math.max(0, toNumber(digits ?? 0));
    return Math.round(toNumber(value) * factor) / factor;
  },
  $floor: ([value]) => Math.floor(toNumber(value)),
  $ceil: ([value]) => Math.ceil(toNumber(value)),
  $abs: ([value]) => Math.abs(toNumber(value)),
  $min: (args) =>
    Math.min(
      ...args
        .flatMap((item) => (Array.isArray(item) ? item : [item]))
        .map(toNumber),
    ),
  $max: (args) =>
    Math.max(
      ...args
        .flatMap((item) => (Array.isArray(item) ? item : [item]))
        .map(toNumber),
    ),
  $sum: (args) =>
    args
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .reduce((total: number, item) => total + toNumber(item), 0),
  $now: () => new Date().toISOString(),
  $today: () => formatDate(new Date(), "YYYY-MM-DD"),
  $date: ([value]) => toDate(value ?? new Date()).toISOString(),
  $formatDate: ([value, pattern]) =>
    formatDate(value, pattern === undefined ? undefined : toText(pattern)),
  $addDays: ([value, days]) =>
    new Date(
      toDate(value).getTime() + toNumber(days) * 86_400_000,
    ).toISOString(),
  $addHours: ([value, hours]) =>
    new Date(
      toDate(value).getTime() + toNumber(hours) * 3_600_000,
    ).toISOString(),
  $diffDays: ([left, right]) =>
    Math.round((toDate(left).getTime() - toDate(right).getTime()) / 86_400_000),
  $encodeUrl: ([value]) => encodeURIComponent(toText(value)),
  $decodeUrl: ([value]) => decodeURIComponent(toText(value)),
  $base64Encode: ([value]) => encodeBase64(toText(value)),
  $base64Decode: ([value]) => decodeBase64(toText(value)),
  $slug: ([value]) =>
    toText(value)
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-+|-+$/g, ""),
  $split: ([value, separator]) => toText(value).split(toText(separator ?? ",")),
  $join: ([value, separator]) =>
    (Array.isArray(value) ? value : [value])
      .map(toText)
      .join(toText(separator ?? ",")),
  $get: ([source, path, fallback]) => {
    const value = getPath(source, toText(path));
    return value === undefined ? fallback : value;
  },
};

export function lookupMethod(
  self: unknown,
  name: string,
): ((args: unknown[]) => unknown) | undefined {
  if (name === "__proto__" || name === "constructor" || name === "prototype")
    return undefined;
  const table: MethodTable | undefined =
    typeof self === "string"
      ? STRING_METHODS
      : Array.isArray(self)
        ? ARRAY_METHODS
        : typeof self === "number"
          ? NUMBER_METHODS
          : isPlainObject(self)
            ? OBJECT_METHODS
            : undefined;
  const method = table?.[name];
  if (!method) return undefined;
  return (args: unknown[]) =>
    (method as (self: unknown, args: unknown[]) => unknown)(self, args);
}
