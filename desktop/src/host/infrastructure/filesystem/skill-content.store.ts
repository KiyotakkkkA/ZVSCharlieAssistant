import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { SkillContentStore } from "../../application/ports/automation-runtime.ports";

export class FileSystemSkillContentStore implements SkillContentStore {
  private readonly resolvedRoot: string;

  constructor(root: string) {
    this.resolvedRoot = resolve(root);
    mkdirSync(this.resolvedRoot, { recursive: true });
  }

  read(slug: string): string {
    try {
      const source = readFileSync(this.path(slug), "utf8");
      const closing = source.indexOf("\n---", 4);
      return closing >= 0 ? source.slice(closing + 4).trimStart() : source;
    } catch {
      return "";
    }
  }

  write(
    slug: string,
    metadata: { name: string; description: string },
    instructions: string,
  ): void {
    const target = this.path(slug);
    const staging = `${target}.tmp`;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      staging,
      `---\nname: ${JSON.stringify(metadata.name)}\ndescription: ${JSON.stringify(metadata.description)}\n---\n\n${instructions.trim()}\n`,
      "utf8",
    );
    renameSync(staging, target);
  }

  remove(slug: string): void {
    rmSync(dirname(this.path(slug)), { recursive: true, force: true });
  }

  private path(slug: string): string {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      throw new Error("Некорректный идентификатор навыка");
    const path = resolve(this.resolvedRoot, slug, "SKILL.md");
    const relativePath = relative(this.resolvedRoot, path);
    if (relativePath.startsWith("..") || isAbsolute(relativePath))
      throw new Error("Некорректный путь навыка");
    return path;
  }
}
