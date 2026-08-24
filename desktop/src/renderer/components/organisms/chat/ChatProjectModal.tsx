import { useEffect, useState, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import type { Project } from "../../../../ipc/contracts";
import type { DirectoryPermission } from "../../../../shared/dto";
import { projectStore } from "../../../stores/ProjectStore";

interface ChatProjectModalProps {
  open: boolean;
  conversationId: string | null;
  onClose: () => void;
}

const PERMISSIONS: DirectoryPermission[] = [
  "read",
  "create",
  "modify",
  "delete",
  "execute",
];

const PERMISSION_LABELS: Record<DirectoryPermission, string> = {
  read: "чтение",
  create: "создание",
  modify: "правка",
  delete: "удаление",
  execute: "запуск",
};

interface DraftGrant {
  path: string;
  recursive: boolean;
  permissions: DirectoryPermission[];
}

interface Draft {
  id?: string;
  name: string;
  rootPath: string;
  instructions: string;
  compactThreshold: number;
  archived: boolean;
  grants: DraftGrant[];
}

const EMPTY_DRAFT: Draft = {
  name: "",
  rootPath: "",
  instructions: "",
  compactThreshold: 0.78,
  archived: false,
  grants: [],
};

export const ChatProjectModal = observer(function ChatProjectModal({
  open,
  conversationId,
  onClose,
}: ChatProjectModalProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) void projectStore.load();
  }, [open]);

  if (!open) return null;

  const startEdit = (project: Project) =>
    setDraft({
      id: project.id,
      name: project.name,
      rootPath: project.rootPath ?? "",
      instructions: project.instructions,
      compactThreshold: project.compactThreshold,
      archived: project.archived,
      grants: project.grants.map((grant) => ({
        path: grant.path,
        recursive: grant.recursive,
        permissions: grant.permissions,
      })),
    });

  const submit = () => {
    if (!draft) return;
    setError(null);
    void projectStore
      .save({
        id: draft.id,
        name: draft.name.trim(),
        rootPath: draft.rootPath.trim() || null,
        instructions: draft.instructions,
        defaultAgentId: null,
        defaultModelId: null,
        compactThreshold: draft.compactThreshold,
        archived: draft.archived,
        grants: draft.grants
          .filter((grant) => grant.path.trim())
          .map((grant) => ({
            path: grant.path.trim(),
            recursive: grant.recursive,
            permissions: grant.permissions,
          })),
      })
      .then(() => setDraft(null))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      );
  };

  return (
    <div className="absolute inset-0 z-30 flex justify-end bg-main-900/60">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-main-700/50 bg-main-800">
        <header className="flex items-center justify-between border-b border-main-700/50 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-main-50">Проекты</h2>
            <p className="mt-0.5 text-xs text-main-500">
              Корень, указания и доступы, общие для всех диалогов проекта
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs text-main-400 hover:bg-main-700/45 hover:text-main-50"
            onClick={onClose}
          >
            Закрыть
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          ) : null}

          {draft ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Field label="Название">
                <input
                  className={inputClass}
                  value={draft.name}
                  maxLength={200}
                  autoFocus
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </Field>

              <Field label="Корень проекта">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={draft.rootPath}
                    placeholder="C:\\Users\\...\\my-app"
                    onChange={(event) =>
                      setDraft({ ...draft, rootPath: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-main-700/45 px-3 text-xs text-main-200 hover:bg-main-700/70"
                    onClick={() => {
                      void window.desktop.selectDirectory().then((path) => {
                        if (path) setDraft({ ...draft, rootPath: path });
                      });
                    }}
                  >
                    Выбрать
                  </button>
                </div>
              </Field>

              <Field label="Указания по проекту">
                <textarea
                  className={`${inputClass} min-h-32 resize-y`}
                  value={draft.instructions}
                  maxLength={20_000}
                  placeholder="Соглашения, команды сборки и тестов, чего делать не нужно"
                  onChange={(event) =>
                    setDraft({ ...draft, instructions: event.target.value })
                  }
                />
                <p className="mt-1 text-[11px] text-main-500">
                  AGENTS.md, ZVS.md или CLAUDE.md из корня подхватываются
                  автоматически
                </p>
              </Field>

              <Field
                label={`Порог сжатия контекста: ${Math.round(draft.compactThreshold * 100)}%`}
              >
                <input
                  type="range"
                  min={40}
                  max={95}
                  value={Math.round(draft.compactThreshold * 100)}
                  className="w-full"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      compactThreshold: Number(event.target.value) / 100,
                    })
                  }
                />
              </Field>

              <Field label="Доступ к директориям">
                <p className="mb-2 text-[11px] text-main-500">
                  Права действуют как пересечение с глобальной политикой и
                  политикой агента: проект может только сузить доступ
                </p>
                {draft.grants.map((grant, index) => (
                  <div
                    key={index}
                    className="mb-2 rounded-xl bg-main-700/25 p-3"
                  >
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        value={grant.path}
                        placeholder="Абсолютный путь"
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            grants: draft.grants.map((item, position) =>
                              position === index
                                ? { ...item, path: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="shrink-0 rounded-lg px-2 text-xs text-rose-300 hover:bg-main-700/50"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            grants: draft.grants.filter(
                              (_item, position) => position !== index,
                            ),
                          })
                        }
                      >
                        Убрать
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PERMISSIONS.map((permission) => (
                        <label
                          key={permission}
                          className="flex items-center gap-1 text-[11px] text-main-300"
                        >
                          <input
                            type="checkbox"
                            checked={grant.permissions.includes(permission)}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                grants: draft.grants.map((item, position) =>
                                  position === index
                                    ? {
                                        ...item,
                                        permissions: event.target.checked
                                          ? [...item.permissions, permission]
                                          : item.permissions.filter(
                                              (value) => value !== permission,
                                            ),
                                      }
                                    : item,
                                ),
                              })
                            }
                          />
                          {PERMISSION_LABELS[permission]}
                        </label>
                      ))}
                      <label className="flex items-center gap-1 text-[11px] text-main-300">
                        <input
                          type="checkbox"
                          checked={grant.recursive}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              grants: draft.grants.map((item, position) =>
                                position === index
                                  ? { ...item, recursive: event.target.checked }
                                  : item,
                              ),
                            })
                          }
                        />
                        вложенные
                      </label>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-lg bg-main-700/45 px-3 py-1.5 text-xs text-main-200 hover:bg-main-700/70"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      grants: [
                        ...draft.grants,
                        {
                          path: draft.rootPath,
                          recursive: true,
                          permissions: ["read"],
                        },
                      ],
                    })
                  }
                >
                  Добавить директорию
                </button>
              </Field>

              <label className="flex items-center gap-2 text-xs text-main-300">
                <input
                  type="checkbox"
                  checked={draft.archived}
                  onChange={(event) =>
                    setDraft({ ...draft, archived: event.target.checked })
                  }
                />
                В архиве
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-xs text-main-400 hover:bg-main-700/45"
                  onClick={() => setDraft(null)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent-medium px-3 py-1.5 text-xs text-main-50 disabled:opacity-50"
                  disabled={!draft.name.trim() || projectStore.saving}
                >
                  Сохранить
                </button>
              </div>
            </form>
          ) : (
            <>
              <button
                type="button"
                className="mb-4 w-full rounded-xl border border-dashed border-main-600/60 px-3 py-2 text-xs text-main-300 hover:bg-main-700/30"
                onClick={() => setDraft({ ...EMPTY_DRAFT })}
              >
                Создать проект
              </button>

              <button
                type="button"
                className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs ${
                  projectStore.activeProjectId === null
                    ? "bg-accent-medium/15 text-accent-light"
                    : "bg-main-700/25 text-main-300 hover:bg-main-700/40"
                }`}
                onClick={() => void projectStore.assign(conversationId, null)}
              >
                Без проекта
              </button>

              {projectStore.projects.map((project) => (
                <div
                  key={project.id}
                  className={`mb-2 rounded-xl px-3 py-2 ${
                    projectStore.activeProjectId === project.id
                      ? "bg-accent-medium/15"
                      : "bg-main-700/25"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        void projectStore.assign(conversationId, project.id)
                      }
                    >
                      <span className="block truncate text-xs font-medium text-main-100">
                        {project.name}
                        {project.archived ? " · архив" : ""}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-main-500">
                        {project.rootPath ?? "без корня"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-main-400 hover:bg-main-700/50 hover:text-main-100"
                      onClick={() => startEdit(project)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-rose-300 hover:bg-main-700/50"
                      onClick={() => void projectStore.remove(project.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

const inputClass =
  "w-full rounded-lg bg-main-700/35 px-3 py-2 text-xs text-main-100 outline-none focus:bg-main-700/55";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-main-500">
        {label}
      </span>
      {children}
    </div>
  );
}
