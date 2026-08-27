import { readdirSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

export interface CompletionItem {
  value: string;
  label: string;
  description: string;
  kind: "command" | "file" | "directory";
  appendSpace: boolean;
}

export function fileSuggestions(
  rootPath: string,
  input: string,
  limit = 8,
): CompletionItem[] {
  if (!input.startsWith("@")) return [];
  const query = input.slice(1).replace(/\\/g, "/");
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
          value: `@${path}`,
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
