import {
  Button,
  InputSmall,
  ScrollArea,
  Tooltip,
} from "@kiyotakkkka/zvs-uikit-lib";
import { FolderIcon, PlusIcon } from "../../atoms";
import { ControlButton } from "../../atoms/buttons";

export interface ChatDialog {
  id: string;
  title: string;
  date: string;
}

export interface ChatProjectItem {
  id: string;
  name: string;
  rootPath: string | null;
  archived: boolean;
}

interface ChatSidebarProps {
  dialogs: ChatDialog[];
  activeDialogId: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (dialog: ChatDialog) => void;
  onCreate: () => void;
  onEdit: (dialog: ChatDialog) => void;
  onDelete: (dialog: ChatDialog) => void;
  projects: ChatProjectItem[];
  activeProjectId: string | null;
  onProjectSelect: (projectId: string | null) => void;
  onProjectCreate: () => void;
  onProjectEdit: (project: ChatProjectItem) => void;
  onProjectDelete: (project: ChatProjectItem) => void;
}

export function ChatSidebar({
  dialogs,
  activeDialogId,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  projects,
  activeProjectId,
  onProjectSelect,
  onProjectCreate,
  onProjectEdit,
  onProjectDelete,
}: ChatSidebarProps) {
  return (
    <aside
      data-tour="chat-sidebar"
      className="flex w-64 shrink-0 flex-col border-r border-main-700/35"
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <span className="px-2 text-sm font-semibold text-main-200">
          Диалоги
        </span>
        <Tooltip label="Новый диалог" placement="bottom-left">
          <Button
            variant="ghost"
            rounded="rounded-lg"
            label="Новый диалог"
            className="inline-flex size-9 items-center justify-center border-0! p-0 text-main-400 shadow-none ring-0! hover:bg-main-700/70 hover:text-main-100"
            onClick={onCreate}
          >
            <PlusIcon className="size-4" />
          </Button>
        </Tooltip>
      </div>
      <div className="px-3 pb-3">
        <InputSmall
          preset="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onClear={() => onQueryChange("")}
          placeholder="Найти диалог"
          className="w-full"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        <div className="space-y-1">
          {dialogs.map((dialog) => (
            <div
              key={dialog.id}
              role="button"
              tabIndex={0}
              className={`flex w-full min-h-10 gap-3 cursor-pointer items-center rounded-xl px-3 text-left transition-colors ${activeDialogId === dialog.id ? "bg-main-700/65" : "hover:bg-main-700/40"} group`}
              onClick={() => onSelect(dialog)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-main-200">
                  {dialog.title}
                </span>
              </span>
              <span className="text-[10px] text-main-400 group-hover:hidden">
                {dialog.date}
              </span>
              <div className="ml-auto gap-1 hidden transition-opacity group-hover:flex space-x-1">
                <span onClick={(event) => event.stopPropagation()}>
                  <ControlButton
                    className="size-6"
                    icon="edit"
                    title="Изменить"
                    onClick={() => onEdit(dialog)}
                  />
                </span>
                <span onClick={(event) => event.stopPropagation()}>
                  <ControlButton
                    className="size-6"
                    icon="trash"
                    variant="delete"
                    title="Удалить"
                    onClick={() => onDelete(dialog)}
                  />
                </span>
              </div>
            </div>
          ))}
          {dialogs.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-main-500">
              Диалоги не найдены
            </p>
          ) : null}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-main-700/35">
        <div className="flex h-14 items-center justify-between px-3">
          <span className="px-2 text-sm font-semibold text-main-200">
            Проекты
          </span>
          <Tooltip label="Новый проект" placement="bottom-left">
            <Button
              variant="ghost"
              rounded="rounded-lg"
              label="Новый проект"
              className="inline-flex size-9 items-center justify-center border-0! p-0 text-main-400 shadow-none ring-0! hover:bg-main-700/70 hover:text-main-100"
              onClick={onProjectCreate}
            >
              <PlusIcon className="size-4" />
            </Button>
          </Tooltip>
        </div>
        <ScrollArea className="max-h-56 px-2 pb-3">
          <div className="space-y-1">
            <div
              role="button"
              tabIndex={0}
              className={`flex w-full min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-left transition-colors ${activeProjectId === null ? "bg-main-700/65" : "hover:bg-main-700/40"}`}
              onClick={() => onProjectSelect(null)}
            >
              <span className="truncate text-sm text-main-400">
                Без проекта
              </span>
            </div>
            {projects.map((project) => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                className={`group flex w-full min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-left transition-colors ${activeProjectId === project.id ? "bg-main-700/65" : "hover:bg-main-700/40"}`}
                onClick={() => onProjectSelect(project.id)}
              >
                <FolderIcon className="size-4 shrink-0 text-main-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-main-200">
                    {project.name}
                  </span>
                  {project.rootPath ? (
                    <span className="block truncate text-[10px] text-main-500">
                      {project.rootPath}
                    </span>
                  ) : null}
                </span>
                {project.archived ? (
                  <span className="text-[10px] text-main-500 group-hover:hidden">
                    архив
                  </span>
                ) : null}
                <div className="ml-auto hidden gap-1 space-x-1 transition-opacity group-hover:flex">
                  <span onClick={(event) => event.stopPropagation()}>
                    <ControlButton
                      className="size-6"
                      icon="edit"
                      title="Изменить"
                      onClick={() => onProjectEdit(project)}
                    />
                  </span>
                  <span onClick={(event) => event.stopPropagation()}>
                    <ControlButton
                      className="size-6"
                      icon="trash"
                      variant="delete"
                      title="Удалить"
                      onClick={() => onProjectDelete(project)}
                    />
                  </span>
                </div>
              </div>
            ))}
            {projects.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-main-500">
                Проектов пока нет
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
