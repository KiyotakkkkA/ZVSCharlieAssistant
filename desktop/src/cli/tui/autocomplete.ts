import { readdirSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

export interface CompletionItem {
  value: string;
  label: string;
  description: string;
  kind: "command" | "file" | "directory" | "skill" | "mode";
  appendSpace: boolean;
}

export interface CliSkillOption {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export function fileSuggestions(
  rootPath: string,
  input: string,
  limit = 8,
): CompletionItem[] {
  const match = input.match(/^@file(?:\s+)?(.*)$/i);
  if (!match) return [];
  const query = (match[1] ?? "").replace(/\\/g, "/");
  const slash = query.lastIndexOf("/");
  const parentPart = slash >= 0 ? query.slice(0, slash + 1) : "";
  const namePart = slash >= 0 ? query.slice(slash + 1) : query;
  try {
    const root = realpathSync(resolve(rootPath));
    const directory = realpathSync(resolve(root, parentPart || "."));
    const fromRoot = relative(root, directory);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) return [];
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) =>
        entry.name.toLocaleLowerCase().startsWith(namePart.toLocaleLowerCase()),
      )
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory())
          return left.isDirectory() ? -1 : 1;
        return left.name.localeCompare(right.name);
      })
      .slice(0, limit)
      .map((entry) => {
        const path = `${parentPart}${entry.name}${entry.isDirectory() ? "/" : ""}`;
        return {
          value: `@file ${path}`,
          label: path,
          description: entry.isDirectory() ? "директория" : "файл",
          kind: entry.isDirectory() ? "directory" : "file",
          appendSpace: !entry.isDirectory(),
        };
      });
  } catch {
    return [];
  }
}

export function skillSuggestions(
  skills: readonly CliSkillOption[],
  input: string,
  limit = 8,
): CompletionItem[] {
  const match = input.match(/^@skill(?:\s+)?(.*)$/i);
  if (!match) return [];
  const query = (match[1] ?? "").trim().toLocaleLowerCase();
  return skills
    .filter((skill) =>
      [skill.name, skill.slug, skill.description].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    )
    .slice(0, limit)
    .map((skill) => ({
      value: skill.id,
      label: skill.name,
      description: `${skill.slug} · ${skill.description}`,
      kind: "skill",
      appendSpace: false,
    }));
}
