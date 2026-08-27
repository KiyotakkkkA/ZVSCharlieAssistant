import { readFile, realpath, stat } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 20 * 1_048_576;
const MAX_TOTAL_BYTES = 40 * 1_048_576;
const SUPPORTED_FILE_PATTERN =
  /\.(txt|md|jsonl?|csv|tsx?|jsx?|mjs|cjs|py|java|kt|go|rs|c|h|cpp|hpp|cs|php|rb|swift|html?|css|scss|less|xml|ya?ml|toml|ini|sql|sh|ps1|bat|cmd|log|pdf|docx)$/i;

export interface CliAttachment {
  path: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataBase64: string;
}

export async function addCliAttachment(
  current: readonly CliAttachment[],
  rootPath: string,
  reference: string,
): Promise<CliAttachment[]> {
  const root = await realpath(resolve(rootPath));
  const requested = reference.startsWith("@") ? reference.slice(1) : reference;
  const path = await realpath(resolve(root, requested));
  const fromRoot = relative(root, path);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`))
    throw new Error("Нельзя прикрепить файл за пределами проекта");
  if (current.some((item) => item.path === path)) return [...current];
  if (current.length >= MAX_FILES)
    throw new Error("Можно прикрепить не более 10 файлов");

  const info = await stat(path);
  if (!info.isFile()) throw new Error("Выбранный путь не является файлом");
  const fileName = basename(path);
  if (!SUPPORTED_FILE_PATTERN.test(fileName))
    throw new Error(`Формат файла «${fileName}» не поддерживается`);
  if (info.size > MAX_FILE_BYTES)
    throw new Error(`Файл «${fileName}» больше 20 МБ`);
  const total = current.reduce((sum, item) => sum + item.size, 0) + info.size;
  if (total > MAX_TOTAL_BYTES)
    throw new Error("Общий размер вложений больше 40 МБ");

  const data = await readFile(path);
  return [
    ...current,
    {
      path,
      fileName,
      mimeType: attachmentMimeType(fileName),
      size: info.size,
      dataBase64: data.toString("base64"),
    },
  ];
}

function attachmentMimeType(fileName: string): string {
  const extension = extname(fileName).toLocaleLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === ".json" || extension === ".jsonl")
    return "application/json";
  if (extension === ".csv") return "text/csv";
  if (extension === ".html" || extension === ".htm") return "text/html";
  if (extension === ".xml") return "application/xml";
  return "text/plain";
}
