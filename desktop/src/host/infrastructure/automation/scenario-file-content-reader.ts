import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { ScenarioFileReference } from "../../../shared/dto/scenario-trigger-event.dto";

export interface ScenarioFileTextContent {
  fileId: number;
  fileName: string;
  mimeType: string | null;
  text: string;
  truncated: boolean;
}

interface ScenarioFileReaderStrategy {
  supports(file: ScenarioFileReference): boolean;
  read(path: string): Promise<string>;
}

abstract class Utf8FileReaderStrategy implements ScenarioFileReaderStrategy {
  abstract readonly extensions: ReadonlySet<string>;

  supports(file: ScenarioFileReference): boolean {
    return this.extensions.has(extname(file.fileName).toLocaleLowerCase());
  }

  read(path: string): Promise<string> {
    return readFile(path, "utf8");
  }
}

class PlainTextFileReaderStrategy extends Utf8FileReaderStrategy {
  readonly extensions = new Set([".txt"]);
}

class MarkdownFileReaderStrategy extends Utf8FileReaderStrategy {
  readonly extensions = new Set([".md"]);
}

export class ScenarioFileContentReader {
  private readonly rootPath: string;
  private readonly strategies: readonly ScenarioFileReaderStrategy[] = [
    new PlainTextFileReaderStrategy(),
    new MarkdownFileReaderStrategy(),
  ];

  constructor(root: string) {
    this.rootPath = resolve(root);
  }

  async read(
    files: ScenarioFileReference[],
    maxCharactersPerFile: number,
  ): Promise<{
    documents: ScenarioFileTextContent[];
    unsupportedFiles: Array<{ fileId: number; fileName: string }>;
  }> {
    const supported = files.flatMap((file) => {
      const strategy = this.strategies.find((item) => item.supports(file));
      return strategy ? [{ file, strategy }] : [];
    });
    const documents = await Promise.all(
      supported.map(async ({ file, strategy }) => {
        const content = await strategy.read(
          this.resolveStorageKey(file.storageKey),
        );
        return {
          fileId: file.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          text: content.slice(0, maxCharactersPerFile),
          truncated: content.length > maxCharactersPerFile,
        };
      }),
    );
    const supportedIds = new Set(supported.map(({ file }) => file.id));
    return {
      documents,
      unsupportedFiles: files
        .filter((file) => !supportedIds.has(file.id))
        .map((file) => ({ fileId: file.id, fileName: file.fileName })),
    };
  }

  private resolveStorageKey(storageKey: string): string {
    const path = resolve(this.rootPath, storageKey);
    if (path !== this.rootPath && !path.startsWith(`${this.rootPath}${sep}`))
      throw new Error("Некорректный путь временного файла");
    return path;
  }
}
