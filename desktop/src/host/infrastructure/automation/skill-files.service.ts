import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export class SkillFilesService {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
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

  write(slug: string, metadata: { name: string; description: string }, instructions: string): void {
    const target = this.path(slug);
    const staging = `${target}.tmp`;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(staging, `---\nname: ${JSON.stringify(metadata.name)}\ndescription: ${JSON.stringify(metadata.description)}\n---\n\n${instructions.trim()}\n`, "utf8");
    renameSync(staging, target);
  }

  remove(slug: string): void {
    rmSync(dirname(this.path(slug)), { recursive: true, force: true });
  }

  private path(slug: string): string {
    const path = resolve(this.root, slug, "SKILL.md");
    if (!path.startsWith(`${resolve(this.root)}\\`)) throw new Error("Некорректный путь навыка");
    return path;
  }
}
