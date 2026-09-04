import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { MAX_VECTOR_DOCUMENT_BYTES } from "../../shared/models/vector-store";
import type { VectorDirectoryPreview } from "../contracts";

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);
const PREVIEW_EXAMPLES_LIMIT = 8;

export interface ScannedVectorFile {
  absolutePath: string;
  relativePath: string;
  size: number;
  mimeType: string;
}

export async function scanVectorDirectory(directoryPath: string): Promise<{
  preview: VectorDirectoryPreview;
  files: ScannedVectorFile[];
}> {
  const root = resolve(directoryPath);
  const rootStat = await stat(root);
  if (!rootStat.isDirectory())
    throw new Error("Выбранный путь не является папкой");

  const pending = [root];
  const files: ScannedVectorFile[] = [];
  let ignoredFiles = 0;
  while (pending.length) {
    const current = pending.pop()!;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = extname(entry.name).toLocaleLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        ignoredFiles += 1;
        continue;
      }
      const fileStat = await stat(absolutePath);
      if (!fileStat.size || fileStat.size > MAX_VECTOR_DOCUMENT_BYTES) {
        ignoredFiles += 1;
        continue;
      }
      files.push({
        absolutePath,
        relativePath: relative(root, absolutePath).replaceAll("\\", "/"),
        size: fileStat.size,
        mimeType: mimeTypeFor(extension),
      });
    }
  }
  files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, "ru"),
  );
  return {
    preview: {
      path: root,
      name: basename(root),
      supportedFiles: files.length,
      ignoredFiles,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      examples: files
        .slice(0, PREVIEW_EXAMPLES_LIMIT)
        .map((file) => file.relativePath),
    },
    files,
  };
}

function mimeTypeFor(extension: string): string {
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "text/plain";
}
