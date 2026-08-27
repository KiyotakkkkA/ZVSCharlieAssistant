import type { DirectoryPermission } from "./dto/directory-policy.dto";

export type TerminalCapabilityId =
  | "filesystem.browse"
  | "document.read"
  | "filesystem.create"
  | "filesystem.modify"
  | "filesystem.delete"
  | "system.inspect"
  | "application.launch"
  | "network.access"
  | "powershell.custom";

export interface TerminalCommandDefinition {
  name: string;
  description: string;
  permission: DirectoryPermission;
  network?: boolean;
}

export interface TerminalCapabilityDefinition {
  id: TerminalCapabilityId;
  title: string;
  description: string;
  risk: "safe" | "attention" | "danger";
  commands: readonly TerminalCommandDefinition[];
}

export const TERMINAL_CAPABILITIES: readonly TerminalCapabilityDefinition[] = [
  {
    id: "filesystem.browse",
    title: "Просматривать файлы и папки",
    description:
      "Показывать содержимое папок, свойства объектов и проверять пути.",
    risk: "safe",
    commands: [
      {
        name: "Get-ChildItem",
        description: "Показывает файлы и вложенные папки.",
        permission: "read",
      },
      {
        name: "Get-Item",
        description: "Получает свойства указанного файла или папки.",
        permission: "read",
      },
      {
        name: "Test-Path",
        description: "Проверяет существование файла или папки.",
        permission: "read",
      },
      {
        name: "Resolve-Path",
        description: "Преобразует путь в полный нормализованный путь.",
        permission: "read",
      },
      {
        name: "Split-Path",
        description: "Выделяет части пути без обращения к содержимому файла.",
        permission: "read",
      },
      {
        name: "Join-Path",
        description: "Безопасно объединяет части пути.",
        permission: "read",
      },
    ],
  },
  {
    id: "document.read",
    title: "Читать содержимое документов",
    description: "Читать текст, искать фрагменты и разбирать CSV или JSON.",
    risk: "safe",
    commands: [
      {
        name: "Get-Content",
        description: "Читает содержимое текстового файла.",
        permission: "read",
      },
      {
        name: "Select-String",
        description: "Ищет текст или шаблон внутри файлов.",
        permission: "read",
      },
      {
        name: "Import-Csv",
        description: "Читает CSV как структурированные строки.",
        permission: "read",
      },
      {
        name: "ConvertFrom-Json",
        description: "Преобразует JSON-текст в объекты PowerShell.",
        permission: "read",
      },
      {
        name: "Select-Object",
        description: "Оставляет только необходимые поля или строки результата.",
        permission: "read",
      },
      {
        name: "Sort-Object",
        description: "Сортирует полученные данные.",
        permission: "read",
      },
      {
        name: "Measure-Object",
        description: "Подсчитывает элементы, строки и числовые показатели.",
        permission: "read",
      },
    ],
  },
  {
    id: "filesystem.create",
    title: "Создавать файлы",
    description: "Создавать новые файлы и папки в разрешённых директориях.",
    risk: "attention",
    commands: [
      {
        name: "New-Item",
        description: "Создаёт новый файл или папку.",
        permission: "create",
      },
      {
        name: "Out-File",
        description: "Записывает результат команды в новый файл.",
        permission: "create",
      },
      {
        name: "Export-Csv",
        description: "Сохраняет табличные данные в CSV-файл.",
        permission: "create",
      },
    ],
  },
  {
    id: "filesystem.modify",
    title: "Изменять существующие файлы",
    description: "Перезаписывать, дополнять, копировать и перемещать файлы.",
    risk: "attention",
    commands: [
      {
        name: "Set-Content",
        description: "Заменяет содержимое существующего файла.",
        permission: "modify",
      },
      {
        name: "Add-Content",
        description: "Добавляет текст в конец файла.",
        permission: "modify",
      },
      {
        name: "Clear-Content",
        description: "Очищает содержимое файла, сохраняя сам файл.",
        permission: "modify",
      },
      {
        name: "Copy-Item",
        description: "Копирует файл или папку.",
        permission: "modify",
      },
      {
        name: "Move-Item",
        description: "Перемещает файл или папку.",
        permission: "modify",
      },
      {
        name: "Rename-Item",
        description: "Переименовывает файл или папку.",
        permission: "modify",
      },
    ],
  },
  {
    id: "filesystem.delete",
    title: "Удалять файлы",
    description:
      "Удалять файлы и папки только после проверки пути и подтверждения.",
    risk: "danger",
    commands: [
      {
        name: "Remove-Item",
        description: "Удаляет разрешённый файл или папку.",
        permission: "delete",
      },
    ],
  },
  {
    id: "system.inspect",
    title: "Получать сведения о компьютере",
    description:
      "Читать сведения об оборудовании, процессах, службах, дисках и сети.",
    risk: "safe",
    commands: [
      {
        name: "Get-ComputerInfo",
        description: "Показывает общие сведения о Windows и оборудовании.",
        permission: "read",
      },
      {
        name: "Get-CimInstance",
        description:
          "Читает системные сведения через стандартный интерфейс CIM.",
        permission: "read",
      },
      {
        name: "Get-Process",
        description: "Показывает запущенные процессы.",
        permission: "read",
      },
      {
        name: "Get-Service",
        description: "Показывает состояние служб Windows.",
        permission: "read",
      },
      {
        name: "Get-PSDrive",
        description:
          "Показывает доступные диски и пространство имён PowerShell.",
        permission: "read",
      },
      {
        name: "Get-Volume",
        description: "Показывает тома и свободное место на дисках.",
        permission: "read",
      },
      {
        name: "Get-NetAdapter",
        description: "Показывает сетевые адаптеры без изменения настроек.",
        permission: "read",
      },
      {
        name: "Get-NetIPAddress",
        description: "Показывает назначенные IP-адреса.",
        permission: "read",
      },
    ],
  },
  {
    id: "application.launch",
    title: "Запускать приложения",
    description:
      "Запускать явно указанное приложение из разрешённой директории.",
    risk: "danger",
    commands: [
      {
        name: "Start-Process",
        description:
          "Запускает приложение или открывает документ связанной программой.",
        permission: "execute",
      },
      {
        name: "Invoke-Item",
        description:
          "Открывает файл или папку приложением Windows по умолчанию.",
        permission: "execute",
      },
    ],
  },
  {
    id: "network.access",
    title: "Использовать интернет",
    description: "Проверять соединение и выполнять HTTP-запросы.",
    risk: "attention",
    commands: [
      {
        name: "Invoke-WebRequest",
        description: "Загружает веб-страницу или файл по URL.",
        permission: "read",
        network: true,
      },
      {
        name: "Invoke-RestMethod",
        description: "Выполняет запрос к веб-API и разбирает ответ.",
        permission: "read",
        network: true,
      },
      {
        name: "Test-NetConnection",
        description: "Проверяет доступность сетевого адреса или порта.",
        permission: "read",
        network: true,
      },
      {
        name: "Resolve-DnsName",
        description: "Получает DNS-записи указанного домена.",
        permission: "read",
        network: true,
      },
    ],
  },
  {
    id: "powershell.custom",
    title: "Выполнять произвольные команды",
    description:
      "Показывает экспертный список. Каждую команду всё равно нужно разрешить отдельно.",
    risk: "danger",
    commands: [],
  },
] as const;

const commandDefinitions = new Map(
  TERMINAL_CAPABILITIES.flatMap((capability) => capability.commands).map(
    (command) => [command.name.toLowerCase(), command] as const,
  ),
);

export const getTerminalCommandDefinition = (command: string) =>
  commandDefinitions.get(command.toLowerCase());

export const KNOWN_TERMINAL_COMMANDS = [...commandDefinitions.values()].map(
  (command) => command.name,
);

export const permissionByCommand = (command: string): DirectoryPermission => {
  const definition = getTerminalCommandDefinition(command);
  if (definition) return definition.permission;
  const value = command.toLowerCase();
  if (
    value.startsWith("get-") ||
    value === "select-string" ||
    value === "test-path"
  )
    return "read";
  if (value === "new-item") return "create";
  if (value === "remove-item") return "delete";
  if (
    value === "move-item" ||
    value === "copy-item" ||
    value === "set-content" ||
    value === "add-content"
  )
    return "modify";
  return "execute";
};

const PERMISSION_RANK: readonly DirectoryPermission[] = [
  "read",
  "create",
  "modify",
  "delete",
  "execute",
];

export function maxPermission(
  commands: readonly string[],
): DirectoryPermission {
  return commands.reduce<DirectoryPermission>((current, command) => {
    const next = permissionByCommand(command);
    return PERMISSION_RANK.indexOf(next) > PERMISSION_RANK.indexOf(current)
      ? next
      : current;
  }, "read");
}

export function extractCommandNames(script: string): string[] {
  return script
    .split(/[;|\r\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((segment) => segment.match(/^([A-Za-z][\w-]*)/)?.[1])
    .filter((item): item is string => Boolean(item));
}
