import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  InputBig,
  InputCheckBox,
  InputSlider,
  InputSmall,
  Modal,
  ScrollArea,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { Project } from "../../../../ipc/contracts";
import type { DirectoryPermission } from "../../../../shared/dto";
import { FolderIcon, ParameterLabel } from "../../atoms";
import { ControlButton, PrimaryButton } from "../../atoms/basic";
import { projectStore } from "../../../stores/ProjectStore";

const PERMISSIONS: Array<{ value: DirectoryPermission; label: string }> = [
  { value: "read", label: "Чтение" },
  { value: "create", label: "Создание" },
  { value: "modify", label: "Изменение" },
  { value: "delete", label: "Удаление" },
  { value: "execute", label: "Запуск" },
];

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

interface ChatProjectModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

function toDraft(project: Project | null): Draft {
  if (!project)
    return {
      name: "",
      rootPath: "",
      instructions: "",
      compactThreshold: 0.78,
      archived: false,
      grants: [],
    };
  return {
    id: project.id,
    name: project.name,
    rootPath: project.rootPath ?? "",
    instructions: project.instructions,
    compactThreshold: project.compactThreshold,
    archived: project.archived,
    grants: project.grants.map((grant) => ({
      path: grant.path,
      recursive: grant.recursive,
      permissions: [...grant.permissions],
    })),
  };
}

export const ChatProjectModal = observer(function ChatProjectModal({
  open,
  project,
  onClose,
  onCreated,
}: ChatProjectModalProps) {
  const toasts = useToasts();
  const [draft, setDraft] = useState<Draft>(() => toDraft(project));

  useEffect(() => {
    if (open) setDraft(toDraft(project));
  }, [open, project]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const updateGrant = (index: number, grant: DraftGrant) =>
    update(
      "grants",
      draft.grants.map((item, position) => (position === index ? grant : item)),
    );

  const addDirectory = async () => {
    const path = await window.desktop.selectDirectory();
    if (!path || draft.grants.some((item) => item.path === path)) return;
    update("grants", [
      ...draft.grants,
      { path, recursive: true, permissions: ["read"] },
    ]);
  };

  const submit = () => {
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
        grants: draft.grants.map((grant) => ({
          path: grant.path,
          recursive: grant.recursive,
          permissions: [...grant.permissions],
        })),
        compactModelId: null,
      })
      .then((saved) => {
        toasts.success({ title: "Проект сохранён" });
        if (!draft.id) onCreated(saved);
        onClose();
      })
      .catch((error: unknown) =>
        toasts.danger({
          title: "Не удалось сохранить проект",
          description: error instanceof Error ? error.message : String(error),
        }),
      );
  };

  return (
    <Modal
      open={open}
      rounded="rounded-4xl"
      className="max-w-6xl "
      onClose={onClose}
    >
      <Modal.Header>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
            <FolderIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-main-50">
              {draft.id ? "Настройки проекта" : "Новый проект"}
            </h2>
            <p className="mt-0.5 text-xs text-main-500">
              Корень, указания и доступы, общие для всех диалогов проекта
            </p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Content className="p-0!">
        <ScrollArea className="max-h-[min(34rem,70vh)]">
          <form
            id="chat-project-form"
            className="space-y-5 px-5 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <InputSmall
              value={draft.name}
              maxLength={200}
              autoFocus
              placeholder="Название проекта"
              className="w-full"
              onChange={(event) => update("name", event.target.value)}
            />

            <div className="flex items-center gap-2">
              <InputSmall
                value={draft.rootPath}
                placeholder="Корень проекта"
                className="w-full"
                onChange={(event) => update("rootPath", event.target.value)}
                onClear={() => update("rootPath", "")}
              />
              <PrimaryButton
                type="button"
                variant="create"
                label="Выбрать"
                onClick={() => {
                  void window.desktop.selectDirectory().then((path) => {
                    if (path) update("rootPath", path);
                  });
                }}
              />
            </div>

            <InputBig
              label="Указания по проекту"
              description="AGENTS.md, ZVS.md или CLAUDE.md из корня подхватываются автоматически"
              value={draft.instructions}
              maxLength={20_000}
              showCount
              autoResize
              minRows={4}
              maxRows={12}
              placeholder="Соглашения, команды сборки и тестов, чего делать не нужно"
              onChange={(event) => update("instructions", event.target.value)}
            />

            <div>
              <span className="mb-2 block text-xs text-main-400">
                <ParameterLabel description="Доля контекстного окна модели, после которой история диалога сжимается автоматически. Исходные сообщения при этом сохраняются.">
                  Порог сжатия контекста
                </ParameterLabel>
              </span>
              <InputSlider
                value={Math.round(draft.compactThreshold * 100)}
                min={40}
                max={95}
                step={1}
                showValue
                valueFormatter={(value) => `${value}%`}
                onChange={(value) => update("compactThreshold", value / 100)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-main-100">
                  Доступ к директориям
                </span>
                <PrimaryButton
                  type="button"
                  variant="create"
                  label="Добавить директорию"
                  onClick={() => void addDirectory()}
                />
              </div>

              {draft.grants.map((grant, index) => (
                <div
                  key={`${grant.path}-${index}`}
                  className="rounded-lg bg-main-800/35 p-4 ring-1 ring-main-700/35"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-main-100">
                      {grant.path}
                    </span>
                    <ControlButton
                      icon="trash"
                      variant="delete"
                      title="Убрать директорию"
                      onClick={() =>
                        update(
                          "grants",
                          draft.grants.filter(
                            (_item, position) => position !== index,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {PERMISSIONS.map((permission) => (
                      <InputCheckBox
                        key={permission.value}
                        checked={grant.permissions.includes(permission.value)}
                        onChange={(state) =>
                          updateGrant(index, {
                            ...grant,
                            permissions: state
                              ? [...grant.permissions, permission.value]
                              : grant.permissions.filter(
                                  (item) => item !== permission.value,
                                ),
                          })
                        }
                      >
                        <ParameterLabel
                          description={`Разрешает право «${permission.label.toLowerCase()}» внутри этой директории, если оно уже разрешено глобальной политикой и политикой агента.`}
                        >
                          {permission.label}
                        </ParameterLabel>
                      </InputCheckBox>
                    ))}
                    <InputCheckBox
                      checked={grant.recursive}
                      onChange={(state) =>
                        updateGrant(index, { ...grant, recursive: state })
                      }
                    >
                      <ParameterLabel description="Распространяет выбранные права на все вложенные директории и файлы.">
                        Включая вложенные
                      </ParameterLabel>
                    </InputCheckBox>
                  </div>
                </div>
              ))}
            </div>

            <InputCheckBox
              checked={draft.archived}
              onChange={(state) => update("archived", state)}
            >
              <ParameterLabel description="Архивный проект остаётся в списке, но не подставляется в контекст новых диалогов.">
                В архиве
              </ParameterLabel>
            </InputCheckBox>
          </form>
        </ScrollArea>
      </Modal.Content>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <PrimaryButton
            type="submit"
            form="chat-project-form"
            variant="save"
            label="Сохранить"
            loading={projectStore.saving}
            disabled={!draft.name.trim()}
          />
        </div>
      </Modal.Footer>
    </Modal>
  );
});
