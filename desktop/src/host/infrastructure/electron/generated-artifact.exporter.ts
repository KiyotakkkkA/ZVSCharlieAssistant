import { copyFile, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { dialog } from "electron";
import type { GeneratedArtifactExporter } from "../../application/ports/generated-artifact.port";

export class ElectronGeneratedArtifactExporter
  implements GeneratedArtifactExporter
{
  private readonly allowedRoot: string;

  constructor(root: string) {
    this.allowedRoot = resolve(root);
  }

  async save(input: { path: string; fileName: string }): Promise<boolean> {
    const source = await realpath(input.path);
    const root = await realpath(this.allowedRoot);
    const relativePath = relative(root, source);
    if (relativePath.startsWith("..") || isAbsolute(relativePath))
      throw new Error("Файл находится вне каталога созданных документов");
    if (!(await stat(source)).isFile()) throw new Error("Документ не найден");

    const result = await dialog.showSaveDialog({
      defaultPath: basename(input.fileName),
      filters: [{ name: "Документ Word", extensions: ["docx"] }],
    });
    if (result.canceled || !result.filePath) return false;
    await copyFile(source, result.filePath);
    return true;
  }
}
