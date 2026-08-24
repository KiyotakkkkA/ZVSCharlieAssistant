import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentDirectoryPolicy, DirectoryGrant } from "../../../shared/dto";
import type { FileEditRecord } from "../../../shared/models/chat";
import type { FileEditRepository } from "../database/file-edit.repository";
import { PathResolver } from "./path-resolver";
import { applyUnifiedDiff, createUnifiedDiff, splitLines } from "./diff";

export interface FileToolContext {
  runId: string | null;
  conversationId: string | null;
  toolCallId: string | null;
  policy: AgentDirectoryPolicy | undefined;
  projectGrants?: DirectoryGrant[];
}

const READ_MAX_BYTES = 400_000;
const DEFAULT_READ_LINES = 800;
const BINARY_PROBE_BYTES = 8_192;
const LIST_DEFAULT_LIMIT = 300;

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  "out",
  ".cache",
]);

interface FileShape {
  eol: "\r\n" | "\n";
  bom: boolean;
}

export class FileSystemService {
  private readonly resolver: PathResolver;
  private readonly reads = new Map<
    string,
    Map<string, { mtimeMs: number; size: number }>
  >();

  constructor(
    resolver: PathResolver,
    private readonly edits: FileEditRepository,
    private readonly checkpointRoot: string,
  ) {
    this.resolver = resolver;
  }

  read(
    input: { path: string; offset?: number; limit?: number },
    context: FileToolContext,
  ) {
    const path = this.resolver.resolve(input.path, "read", policiesOf(context));
    const stats = statSync(path);
    if (stats.isDirectory())
      throw new Error(`«${path}» — директория. Используйте fs_list.`);
    if (stats.size > READ_MAX_BYTES)
      throw new Error(
        `Файл слишком велик (${stats.size} байт). Читайте фрагментами через offset и limit или используйте regexp_search.`,
      );

    const buffer = readFileSync(path);
    assertText(buffer, path);
    const { text } = decode(buffer);
    const lines = splitLines(text);
    const offset = Math.max(0, input.offset ?? 0);
    const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_READ_LINES, 5_000));
    const slice = lines.slice(offset, offset + limit);

    this.rememberRead(context.runId, path, stats);

    return {
      path,
      totalLines: lines.length,
      from: offset + 1,
      to: offset + slice.length,
      truncated: offset + slice.length < lines.length,
      content: slice
        .map((line, index) => `${offset + index + 1}\t${line}`)
        .join("\n"),
    };
  }

  list(
    input: {
      path: string;
      depth?: number;
      limit?: number;
      includeHidden?: boolean;
    },
    context: FileToolContext,
  ) {
    const root = this.resolver.resolve(input.path, "read", policiesOf(context));
    const maxDepth = Math.max(1, Math.min(input.depth ?? 2, 8));
    const limit = Math.max(1, Math.min(input.limit ?? LIST_DEFAULT_LIMIT, 2_000));
    const entries: Array<{ path: string; type: "file" | "dir"; size?: number }> =
      [];

    const walk = (directory: string, depth: number) => {
      if (entries.length >= limit || depth > maxDepth) return;
      for (const item of readdirSync(directory, { withFileTypes: true })) {
        if (entries.length >= limit) return;
        if (!input.includeHidden && item.name.startsWith(".")) continue;
        if (item.isDirectory() && IGNORED_DIRECTORIES.has(item.name)) continue;
        const full = join(directory, item.name);
        const rel = relative(root, full) || item.name;
        if (item.isDirectory()) {
          entries.push({ path: rel, type: "dir" });
          walk(full, depth + 1);
        } else if (item.isFile()) {
          entries.push({ path: rel, type: "file", size: statSync(full).size });
        }
      }
    };
    walk(root, 1);
    return { root, entries, truncated: entries.length >= limit };
  }

  write(
    input: { path: string; content: string },
    context: FileToolContext,
  ): FileEditRecord {
    const path = this.resolver.resolve(input.path, "read", policiesOf(context));
    const exists = existsSync(path);
    this.resolver.resolve(input.path, exists ? "modify" : "create", policiesOf(context));
    const before = exists ? this.readForEdit(path, context) : "";
    return this.commit(
      path,
      before,
      input.content,
      context,
      exists ? "modify" : "create",
    );
  }

  edit(
    input: {
      path: string;
      oldText: string;
      newText: string;
      replaceAll?: boolean;
    },
    context: FileToolContext,
  ): FileEditRecord {
    const path = this.resolver.resolve(input.path, "modify", policiesOf(context));
    const before = this.readForEdit(path, context);
    const after = replaceFragment(
      before,
      input.oldText,
      input.newText,
      Boolean(input.replaceAll),
      path,
    );
    return this.commit(path, before, after, context, "modify");
  }

  multiEdit(
    input: {
      path: string;
      edits: Array<{ oldText: string; newText: string; replaceAll?: boolean }>;
    },
    context: FileToolContext,
  ): FileEditRecord {
    const path = this.resolver.resolve(input.path, "modify", policiesOf(context));
    const before = this.readForEdit(path, context);
    let after = before;
    input.edits.forEach((item, index) => {
      try {
        after = replaceFragment(
          after,
          item.oldText,
          item.newText,
          Boolean(item.replaceAll),
          path,
        );
      } catch (error) {
        throw new Error(
          `Правка №${index + 1} не применена: ${
            error instanceof Error ? error.message : String(error)
          }. Ни одна правка не сохранена.`,
        );
      }
    });
    return this.commit(path, before, after, context, "modify");
  }

  applyPatch(
    input: { path: string; patch: string },
    context: FileToolContext,
  ): FileEditRecord {
    const path = this.resolver.resolve(input.path, "modify", policiesOf(context));
    const before = this.readForEdit(path, context);
    const after = applyUnifiedDiff(before, input.patch);
    return this.commit(path, before, after, context, "modify");
  }

  move(
    input: { from: string; to: string },
    context: FileToolContext,
  ): FileEditRecord {
    const from = this.resolver.resolve(input.from, "delete", policiesOf(context));
    const to = this.resolver.resolve(input.to, "create", policiesOf(context));
    if (existsSync(to)) throw new Error(`Целевой путь «${to}» уже существует`);
    const stats = statSync(from);
    const checkpoint = this.checkpoint(from, context);
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
    return this.edits.recordEdit({
      runId: context.runId,
      conversationId: context.conversationId,
      checkpointId: checkpoint.id,
      toolCallId: context.toolCallId,
      path: from,
      operation: "move",
      movedTo: to,
      diff: `--- a/${from}\n+++ b/${to}\n`,
      bytesBefore: stats.size,
      bytesAfter: stats.size,
    });
  }

  remove(input: { path: string }, context: FileToolContext): FileEditRecord {
    const path = this.resolver.resolve(input.path, "delete", policiesOf(context));
    const stats = statSync(path);
    if (stats.isDirectory())
      throw new Error("Удаление директорий через агента не поддерживается");
    const checkpoint = this.checkpoint(path, context);
    const trash = join(
      this.checkpointRoot,
      "trash",
      context.runId ?? "manual",
      `${randomUUID()}-${basename(path)}`,
    );
    mkdirSync(dirname(trash), { recursive: true });
    renameSync(path, trash);
    return this.edits.recordEdit({
      runId: context.runId,
      conversationId: context.conversationId,
      checkpointId: checkpoint.id,
      toolCallId: context.toolCallId,
      path,
      operation: "delete",
      diff: `--- a/${path}\n+++ /dev/null\n`,
      bytesBefore: stats.size,
      bytesAfter: 0,
    });
  }

  revertRun(runId: string): { restored: string[]; failed: string[] } {
    const restored: string[] = [];
    const failed: string[] = [];
    for (const checkpoint of this.edits.checkpointsForRun(runId).reverse()) {
      try {
        if (!checkpoint.existed) {
          if (existsSync(checkpoint.path)) unlinkSync(checkpoint.path);
        } else if (checkpoint.backupPath && existsSync(checkpoint.backupPath)) {
          mkdirSync(dirname(checkpoint.path), { recursive: true });
          copyFileSync(checkpoint.backupPath, checkpoint.path);
        } else {
          failed.push(checkpoint.path);
          continue;
        }
        restored.push(checkpoint.path);
      } catch {
        failed.push(checkpoint.path);
      }
    }
    if (restored.length) this.edits.markReverted(runId);
    this.reads.delete(runId);
    return { restored, failed };
  }

  forgetRun(runId: string) {
    this.reads.delete(runId);
  }

  private readForEdit(path: string, context: FileToolContext): string {
    const stats = statSync(path);
    const remembered = context.runId
      ? this.reads.get(context.runId)?.get(path)
      : undefined;
    if (!remembered)
      throw new Error(
        `Файл «${path}» не был прочитан в этой задаче. Сначала вызовите fs_read — правка вслепую запрещена.`,
      );
    if (
      remembered.mtimeMs !== stats.mtimeMs ||
      remembered.size !== stats.size
    )
      throw new Error(
        `Файл «${path}» изменился после чтения. Перечитайте его через fs_read, иначе правка затрёт чужие изменения.`,
      );
    const buffer = readFileSync(path);
    assertText(buffer, path);
    return decode(buffer).text;
  }

  private rememberRead(
    runId: string | null,
    path: string,
    stats: { mtimeMs: number; size: number },
  ) {
    if (!runId) return;
    const forRun = this.reads.get(runId) ?? new Map();
    forRun.set(path, { mtimeMs: stats.mtimeMs, size: stats.size });
    this.reads.set(runId, forRun);
  }

  private checkpoint(path: string, context: FileToolContext) {
    const existed = existsSync(path);
    let backupPath: string | null = null;
    let bytesBefore = 0;
    if (existed) {
      const stats = statSync(path);
      bytesBefore = stats.size;
      backupPath = join(
        this.checkpointRoot,
        "backups",
        context.runId ?? "manual",
        `${randomUUID()}-${basename(path)}`,
      );
      mkdirSync(dirname(backupPath), { recursive: true });
      copyFileSync(path, backupPath);
    }
    return this.edits.ensureCheckpoint({
      runId: context.runId,
      conversationId: context.conversationId,
      path,
      existed,
      backupPath,
      bytesBefore,
    });
  }

  private commit(
    path: string,
    before: string,
    after: string,
    context: FileToolContext,
    operation: FileEditRecord["operation"],
  ): FileEditRecord {
    if (before === after)
      throw new Error(
        `Содержимое «${path}» не изменилось — правка не применена.`,
      );
    const checkpoint = this.checkpoint(path, context);
    const shape = detectShape(before, path);
    const payload = encode(after, shape);

    mkdirSync(dirname(path), { recursive: true });
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    writeFileSync(temporary, payload);
    renameSync(temporary, path);

    const stats = statSync(path);
    this.rememberRead(context.runId, path, stats);

    const { diff } = createUnifiedDiff(path, before, after);
    return this.edits.recordEdit({
      runId: context.runId,
      conversationId: context.conversationId,
      checkpointId: checkpoint.id,
      toolCallId: context.toolCallId,
      path,
      operation,
      diff,
      bytesBefore: Buffer.byteLength(before, "utf8"),
      bytesAfter: stats.size,
    });
  }
}

function policiesOf(context: FileToolContext) {
  return { agent: context.policy, project: context.projectGrants };
}

function replaceFragment(
  source: string,
  oldText: string,
  newText: string,
  replaceAll: boolean,
  path: string,
): string {
  if (!oldText)
    throw new Error("Заменяемый фрагмент пуст — уточните, что именно менять");
  const occurrences = countOccurrences(source, oldText);
  if (occurrences === 0)
    throw new Error(
      `Фрагмент не найден в «${path}». Скопируйте его из вывода fs_read дословно, включая отступы.`,
    );
  if (occurrences > 1 && !replaceAll)
    throw new Error(
      `Фрагмент встречается ${occurrences} раз в «${path}». Добавьте окружающие строки для однозначности или укажите replaceAll.`,
    );
  return replaceAll
    ? source.split(oldText).join(newText)
    : source.replace(oldText, newText);
}

function countOccurrences(source: string, fragment: string): number {
  let count = 0;
  let index = source.indexOf(fragment);
  while (index !== -1) {
    count += 1;
    index = source.indexOf(fragment, index + fragment.length);
  }
  return count;
}

function assertText(buffer: Buffer, path: string) {
  const probe = buffer.subarray(0, BINARY_PROBE_BYTES);
  if (probe.includes(0))
    throw new Error(`«${path}» — двоичный файл, текстовые инструменты к нему неприменимы`);
}

function decode(buffer: Buffer): { text: string } {
  const hasBom =
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf;
  return { text: buffer.toString("utf8", hasBom ? 3 : 0) };
}

function detectShape(before: string, path: string): FileShape {
  const crlf = (before.match(/\r\n/g) ?? []).length;
  const lf = (before.match(/\n/g) ?? []).length - crlf;
  return {
    eol: crlf > lf ? "\r\n" : "\n",
    bom: existsSync(path) ? hasBom(path) : false,
  };
}

function hasBom(path: string): boolean {
  try {
    const head = readFileSync(path).subarray(0, 3);
    return head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
  } catch {
    return false;
  }
}

function encode(text: string, shape: FileShape): Buffer {
  const normalized =
    shape.eol === "\r\n"
      ? text.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")
      : text.replace(/\r\n/g, "\n");
  const body = Buffer.from(normalized, "utf8");
  return shape.bom
    ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])
    : body;
}
