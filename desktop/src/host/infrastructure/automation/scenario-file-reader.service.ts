import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { ScenarioFileReference } from "../../../shared/dto/scenario-trigger-event.dto";
import type { TextExtractionClient } from "../vector-store/text-extraction.client";

export interface ScenarioFileTextContent {
  fileId: number;
  fileName: string;
  mimeType: string | null;
  text: string;
  truncated: boolean;
}

/** Читается как обычный текст, без внешних зависимостей. */
const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".log"]);

/** Разбирается в потоке извлечения (mammoth / pdfjs). */
const DOCUMENT_EXTENSIONS = new Set([".docx", ".pdf"]);

function isSupported(fileName: string): boolean {
  const extension = extname(fileName).toLocaleLowerCase();
  return (
    PLAIN_TEXT_EXTENSIONS.has(extension) || DOCUMENT_EXTENSIONS.has(extension)
  );
}

export class ScenarioFileReaderService {
  private readonly rootPath: string;

  constructor(
    root: string,
    private readonly extraction: TextExtractionClient,
  ) {
    this.rootPath = resolve(root);
  }

  async read(
    files: ScenarioFileReference[],
    maxCharactersPerFile: number,
  ): Promise<{
    documents: ScenarioFileTextContent[];
    unsupportedFiles: Array<{ fileId: number; fileName: string }>;
  }> {
    const supported = files.filter((file) => isSupported(file.fileName));
    const documents = await Promise.all(
      supported.map(async (file) => {
        const content = await this.readFileText(file);
        return {
          fileId: file.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          text: content.slice(0, maxCharactersPerFile),
          truncated: content.length > maxCharactersPerFile,
        };
      }),
    );
    const supportedIds = new Set(supported.map((file) => file.id));
    return {
      documents,
      unsupportedFiles: files
        .filter((file) => !supportedIds.has(file.id))
        .map((file) => ({ fileId: file.id, fileName: file.fileName })),
    };
  }

  /**
   * Раньше поддерживались только `.txt` и `.md`, а ради их различения
   * существовала иерархия из трёх классов-стратегий с одинаковым чтением.
   * Вложение в DOCX или PDF молча попадало в `unsupportedFiles`, хотя разбор
   * этих форматов в проекте уже был — им пользовалось векторное хранилище.
   */
  private async readFileText(file: ScenarioFileReference): Promise<string> {
    const path = this.resolveStorageKey(file.storageKey);
    const extension = extname(file.fileName).toLocaleLowerCase();
    if (PLAIN_TEXT_EXTENSIONS.has(extension)) return readFile(path, "utf8");
    const buffer = await readFile(path);
    return this.extraction.extract(
      file.fileName,
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
    );
  }

  private resolveStorageKey(storageKey: string): string {
    const path = resolve(this.rootPath, storageKey);
    if (path !== this.rootPath && !path.startsWith(`${this.rootPath}${sep}`))
      throw new Error("Некорректный путь временного файла");
    return path;
  }
}
