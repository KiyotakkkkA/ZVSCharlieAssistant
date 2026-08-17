import {
  createWriteStream,
  mkdirSync,
  renameSync,
  statSync,
  type WriteStream,
} from "node:fs";
import { join } from "node:path";
import { sanitize, serializeError } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogFields = Record<string, unknown>;

export interface LogRecord extends LogFields {
  ts: string;
  level: LogLevel;
  event: string;
}

export interface Logger {
  child(fields: LogFields): Logger;
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, error?: unknown, fields?: LogFields): void;
  time<T>(
    event: string,
    fields: LogFields,
    operation: () => Promise<T>,
  ): Promise<T>;
  recent(limit?: number): LogRecord[];
  level: LogLevel;
}

export interface LoggerOptions {
  directory: string;
  fileName?: string;
  level?: LogLevel;
  maxFileBytes?: number;
  maxFiles?: number;
  console?: boolean;
  ringBufferSize?: number;
}

class RingBuffer<T> {
  private readonly items: (T | undefined)[];
  private cursor = 0;
  private filled = false;

  constructor(private readonly capacity: number) {
    this.items = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    this.items[this.cursor] = item;
    this.cursor = (this.cursor + 1) % this.capacity;
    if (this.cursor === 0) this.filled = true;
  }

  toArray(limit = this.capacity): T[] {
    const size = this.filled ? this.capacity : this.cursor;
    const result: T[] = [];
    const take = Math.min(limit, size);
    for (let index = size - take; index < size; index++) {
      const slot = this.filled ? (this.cursor + index) % this.capacity : index;
      const item = this.items[slot];
      if (item !== undefined) result.push(item);
    }
    return result;
  }
}

class FileLogger implements Logger {
  private stream?: WriteStream;
  private written = 0;
  private readonly ring: RingBuffer<LogRecord>;
  private readonly path: string;
  private disposed = false;

  constructor(
    private readonly options: Required<Omit<LoggerOptions, "level">> & {
      level: LogLevel;
    },
    private readonly context: LogFields = {},
    shared?: { ring: RingBuffer<LogRecord>; owner: FileLogger },
  ) {
    this.path = join(options.directory, options.fileName);
    if (shared) {
      this.ring = shared.ring;
      this.owner = shared.owner;
    } else {
      this.ring = new RingBuffer<LogRecord>(options.ringBufferSize);
      this.owner = this;
      this.open();
    }
  }

  private readonly owner: FileLogger;

  get level(): LogLevel {
    return this.options.level;
  }

  set level(value: LogLevel) {
    this.options.level = value;
  }

  private open(): void {
    try {
      mkdirSync(this.options.directory, { recursive: true });
      try {
        this.written = statSync(this.path).size;
      } catch {
        this.written = 0;
      }
      this.stream = createWriteStream(this.path, { flags: "a" });
      this.stream.on("error", () => {
        this.stream = undefined;
      });
    } catch {
      this.stream = undefined;
    }
  }

  private rotate(): void {
    if (!this.stream) return;
    this.stream.end();
    this.stream = undefined;
    try {
      for (let index = this.options.maxFiles - 1; index >= 1; index--) {
        const from = index === 1 ? this.path : `${this.path}.${index - 1}`;
        const to = `${this.path}.${index}`;
        try {
          statSync(from);
          renameSync(from, to);
        } catch {
          /* файла нет — пропускаем */
        }
      }
    } catch {
      /* ротация не критична */
    }
    this.open();
  }

  child(fields: LogFields): Logger {
    return new FileLogger(
      this.options,
      { ...this.context, ...fields },
      {
        ring: this.ring,
        owner: this.owner,
      },
    );
  }

  private write(level: LogLevel, event: string, fields?: LogFields): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.options.level]) return;
    if (this.disposed) return;

    const record = {
      ts: new Date().toISOString(),
      level,
      event,
      ...(sanitize({ ...this.context, ...fields }) as LogFields),
    } as LogRecord;

    this.ring.push(record);

    let line: string;
    try {
      line = `${JSON.stringify(record)}\n`;
    } catch {
      line = `${JSON.stringify({ ts: record.ts, level, event, error: "запись не сериализуется" })}\n`;
    }

    const owner = this.owner;
    if (owner.stream) {
      owner.stream.write(line);
      owner.written += Buffer.byteLength(line);
      if (owner.written >= owner.options.maxFileBytes) owner.rotate();
    }

    if (this.options.console) {
      const target =
        level === "error" || level === "warn" ? process.stderr : process.stdout;
      target.write(line);
    }
  }

  debug(event: string, fields?: LogFields): void {
    this.write("debug", event, fields);
  }

  info(event: string, fields?: LogFields): void {
    this.write("info", event, fields);
  }

  warn(event: string, fields?: LogFields): void {
    this.write("warn", event, fields);
  }

  error(event: string, error?: unknown, fields?: LogFields): void {
    this.write("error", event, {
      ...fields,
      ...(error === undefined ? {} : { error: serializeError(error) }),
    });
  }

  async time<T>(
    event: string,
    fields: LogFields,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await operation();
      this.write("info", event, {
        ...fields,
        durationMs: Math.round(performance.now() - startedAt),
        ok: true,
      });
      return result;
    } catch (error) {
      this.write("error", event, {
        ...fields,
        durationMs: Math.round(performance.now() - startedAt),
        ok: false,
        error: serializeError(error),
      });
      throw error;
    }
  }

  recent(limit = 200): LogRecord[] {
    return this.ring.toArray(limit);
  }

  dispose(): void {
    this.disposed = true;
    this.owner.stream?.end();
    this.owner.stream = undefined;
  }
}

export function createNullLogger(): Logger {
  const noop = (): void => undefined;
  const logger: Logger = {
    child: () => logger,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    time: async (_event, _fields, operation) => operation(),
    recent: () => [],
    level: "info",
  };
  return logger;
}

export function createLogger(options: LoggerOptions): Logger {
  return new FileLogger({
    directory: options.directory,
    fileName: options.fileName ?? "zvs.ndjson",
    level: options.level ?? "info",
    maxFileBytes: options.maxFileBytes ?? 8 * 1024 * 1024,
    maxFiles: options.maxFiles ?? 5,
    console: options.console ?? process.env.NODE_ENV !== "production",
    ringBufferSize: options.ringBufferSize ?? 1_000,
  });
}

export function disposeLogger(logger: Logger): void {
  if (logger instanceof FileLogger) logger.dispose();
}

let ambient: Logger = createNullLogger();

export function setAmbientLogger(logger: Logger): void {
  ambient = logger;
}

export function log(): Logger {
  return ambient;
}
