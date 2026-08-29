import { useState } from "react";
import {
  Alert,
  Button,
  InputSmall,
  Switcher,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  DataTransferConflictPolicy,
  ImportPreview,
  ImportResult,
} from "../../../../../shared/models/data-transfer";
import {
  dataTransferRequiredBy,
  resolveDataTransferEntities,
  type DataTransferEntity,
} from "../../../../../shared/dto";
import {
  DownloadIcon,
  GlobalSettingsLabel,
  GraphIcon,
  LockIcon,
  NumbersIcon,
  PolicyIcon,
  RobotIcon,
  ScriptIcon,
  SkillIcon,
  StorageIcon,
  TransitConnectionIcon,
  TrashIcon,
  UploadIcon,
} from "../../../atoms";
import {
  CompactEntitySelector,
  type CompactEntitySelectorItem,
} from "../../../molecules";
import {
  automationStore,
  integrationStore,
  memoryStore,
  secretStorageStore,
  terminalPolicyStore,
  textProviderStore,
  vectorStoreStore,
} from "../../../../stores";
import { DangerModal } from "../../modals";
import { DATA_ANCHORS } from "./settings-sections";

export function GlobalSettingsDataForm() {
  const toasts = useToasts();
  const [exportPassword, setExportPassword] = useState("");
  const [exportConfirmation, setExportConfirmation] = useState("");
  const [exportEntities, setExportEntities] = useState<Record<string, boolean>>(
    {
      secretCategories: true,
      secrets: true,
      terminalPolicy: true,
      memoryPolicy: true,
      skills: true,
      providers: true,
      integrations: true,
      vectorStores: true,
      agents: true,
      scenarios: true,
    },
  );
  const [importPassword, setImportPassword] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [conflictPolicy, setConflictPolicy] =
    useState<DataTransferConflictPolicy>("skip");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [busy, setBusy] = useState<"export" | "prepare" | "commit" | null>(
    null,
  );

  const exportData = async () => {
    const entities = DATA_TRANSFER_ENTITIES.filter(
      (entity) => exportEntities[entity],
    );
    if (!entities.length) {
      toasts.warning({ title: "Выберите данные для экспорта" });
      return;
    }
    if (exportPassword.length < 8) {
      toasts.warning({ title: "Пароль должен содержать не менее 8 символов" });
      return;
    }
    if (exportPassword !== exportConfirmation) {
      toasts.warning({ title: "Пароли не совпадают" });
      return;
    }
    setBusy("export");
    try {
      const saved = await window.desktop.dataTransfer.exportData({
        password: exportPassword,
        entities,
      });
      if (saved) {
        setExportPassword("");
        setExportConfirmation("");
        toasts.success({ title: "Защищённая копия создана" });
      }
    } catch (error) {
      showError(toasts, "Не удалось экспортировать данные", error);
    } finally {
      setBusy(null);
    }
  };

  const prepareImport = async () => {
    if (preview)
      await window.desktop.dataTransfer.cancelImport(preview.sessionId);
    setBusy("prepare");
    try {
      const next = await window.desktop.dataTransfer.prepareImport({
        password: importPassword,
      });
      setPreview(next);
      if (next) setImportPassword("");
    } catch (error) {
      showError(toasts, "Не удалось прочитать файл", error);
    } finally {
      setBusy(null);
    }
  };

  const commitImport = async () => {
    if (!preview) return;
    setBusy("commit");
    try {
      const result = await window.desktop.dataTransfer.commitImport({
        sessionId: preview.sessionId,
        conflictPolicy,
      });
      await Promise.all([
        secretStorageStore.bootstrap(true),
        terminalPolicyStore.bootstrap(true),
        memoryStore.bootstrap(true),
        automationStore.bootstrap(true),
        textProviderStore.bootstrap(true),
        integrationStore.bootstrap(true),
        vectorStoreStore.bootstrap(true),
      ]);
      setPreview(null);
      toasts.success({
        title: "Импорт завершён",
        description: importResultDescription(result),
      });
    } catch (error) {
      showError(toasts, "Не удалось импортировать данные", error);
    } finally {
      setBusy(null);
    }
  };

  const cancelPreview = async () => {
    if (preview)
      await window.desktop.dataTransfer.cancelImport(preview.sessionId);
    setPreview(null);
  };

  const resetData = async () => {
    if (preview)
      await window.desktop.dataTransfer.cancelImport(preview.sessionId);
    await window.desktop.dataTransfer.resetData();
  };

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <GlobalSettingsLabel {...DATA_ANCHORS.export} />
        <CompactEntitySelector
          items={exportEntityItems(exportEntities)}
          model={exportEntities}
          searchPlaceholder="Найти данные"
          onModelChange={(model) => {
            const selected = DATA_TRANSFER_ENTITIES.filter(
              (entity) => model[entity],
            );
            const resolved = new Set(resolveDataTransferEntities(selected));
            setExportEntities(
              Object.fromEntries(
                DATA_TRANSFER_ENTITIES.map((entity) => [
                  entity,
                  resolved.has(entity),
                ]),
              ),
            );
          }}
        />
        <div className="grid gap-3 grid-cols-5">
          <InputSmall
            className="col-span-2"
            preset="password"
            autoComplete="new-password"
            maxLength={256}
            value={exportPassword}
            placeholder="Пароль шифрования"
            onChange={(event) => setExportPassword(event.target.value)}
          />
          <InputSmall
            className="col-span-2"
            preset="password"
            autoComplete="new-password"
            maxLength={256}
            value={exportConfirmation}
            placeholder="Повторите пароль"
            onChange={(event) => setExportConfirmation(event.target.value)}
          />
          <Button
            variant="primary"
            className="px-2"
            loading={busy === "export"}
            disabled={busy !== null}
            onClick={() => void exportData()}
          >
            <DownloadIcon className="size-4" />
            Экспортировать
          </Button>
        </div>
      </section>

      <section className="space-y-5 border-t border-main-700/35 pt-8">
        <GlobalSettingsLabel {...DATA_ANCHORS.import} />
        <div className="flex flex-col gap-3 md:flex-row">
          <InputSmall
            preset="password"
            autoComplete="new-password"
            maxLength={256}
            value={importPassword}
            placeholder="Пароль от копии, если он установлен"
            className="min-w-0 flex-1"
            onChange={(event) => setImportPassword(event.target.value)}
          />
          <Button
            variant="secondary"
            loading={busy === "prepare"}
            disabled={busy !== null}
            onClick={() => void prepareImport()}
          >
            <UploadIcon className="size-4" />
            Выбрать и проверить файл
          </Button>
        </div>

        {preview ? (
          <div className="space-y-4 rounded-xl border border-main-700/45 bg-main-800/35 p-4">
            <div>
              <h4 className="text-sm font-medium text-main-100">
                {preview.fileName}
              </h4>
              <p className="mt-1 text-xs text-main-500">
                Проверьте состав и изменения перед импортом.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {DATA_TRANSFER_ENTITIES.flatMap((entity) => {
                const counts = preview.entities[entity];
                return counts ? (
                  <ImportCountsCard
                    key={entity}
                    label={ENTITY_LABELS[entity]}
                    counts={counts}
                  />
                ) : (
                  []
                );
              })}
              <PoliciesImportCard policies={preview.policies} />
            </div>
            {preview.missingDependencies.length ? (
              <Alert
                variant="warning"
                title={`Не найдены зависимости: ${preview.missingDependencies.length}`}
              >
                Сначала импортируйте недостающие связанные сущности или выберите
                полную копию. Импорт этой копии будет заблокирован.
              </Alert>
            ) : null}
            {totalConflicts(preview) ? (
              <Alert
                variant="warning"
                title={`Конфликты: ${totalConflicts(preview)}`}
              >
                Одинаковое естественное имя связано с разными UUID. Импорт
                заблокирован, чтобы не нарушить связи между сущностями.
              </Alert>
            ) : null}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Switcher
                value={conflictPolicy}
                options={[
                  { value: "skip", label: "Пропустить существующие" },
                  { value: "overwrite", label: "Обновить существующие" },
                ]}
                onChange={(value) =>
                  setConflictPolicy(value as DataTransferConflictPolicy)
                }
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => void cancelPreview()}
                >
                  Отмена
                </Button>
                <Button
                  variant="primary"
                  loading={busy === "commit"}
                  disabled={
                    busy !== null ||
                    preview.missingDependencies.length > 0 ||
                    preview.conflicts.length > 0
                  }
                  onClick={() => void commitImport()}
                >
                  Импортировать
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-5 border-t border-danger-medium/25 pt-8">
        <GlobalSettingsLabel {...DATA_ANCHORS.reset} />
        <div className="flex flex-col gap-4 rounded-xl border border-danger-medium/30 bg-danger-medium/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h4 className="text-sm font-medium text-main-100">
              Вернуть приложение в исходное состояние
            </h4>
            <p className="mt-1 text-xs leading-5 text-main-400">
              Будут удалены диалоги, задачи, настройки, подключения, секреты,
              агенты, навыки, сценарии и локальные файлы приложения.
            </p>
          </div>
          <Button
            variant="danger"
            className="shrink-0 px-3"
            disabled={busy !== null}
            onClick={() => setResetModalOpen(true)}
          >
            <TrashIcon className="size-4" />
            Сбросить все данные
          </Button>
        </div>
      </section>

      <DangerModal
        open={resetModalOpen}
        model={true}
        title="Сбросить все данные?"
        description={
          <div className="space-y-3">
            <p>
              Приложение удалит все свои данные и перезапустится. После запуска
              оно будет выглядеть так, будто вы открыли его впервые.
            </p>
            <p className="font-medium text-danger-light">
              Это действие нельзя отменить.
            </p>
          </div>
        }
        confirmLabel="Сбросить всё"
        onCancel={() => setResetModalOpen(false)}
        onConfirm={resetData}
      />
    </div>
  );
}

const DATA_TRANSFER_ENTITIES = [
  "secretCategories",
  "secrets",
  "terminalPolicy",
  "memoryPolicy",
  "skills",
  "providers",
  "integrations",
  "vectorStores",
  "agents",
  "scenarios",
] as const satisfies readonly DataTransferEntity[];

const ENTITY_LABELS: Record<DataTransferEntity, string> = {
  secretCategories: "Категории секретов",
  secrets: "Секреты",
  terminalPolicy: "Работа с терминалом",
  memoryPolicy: "Память",
  skills: "Навыки",
  providers: "Провайдеры и модели",
  integrations: "Интеграции",
  vectorStores: "Векторные хранилища",
  agents: "Агенты",
  scenarios: "Сценарии",
};

const ENTITY_ICONS: Record<DataTransferEntity, typeof StorageIcon> = {
  secretCategories: StorageIcon,
  secrets: LockIcon,
  terminalPolicy: PolicyIcon,
  memoryPolicy: PolicyIcon,
  skills: SkillIcon,
  providers: RobotIcon,
  integrations: TransitConnectionIcon,
  vectorStores: NumbersIcon,
  agents: GraphIcon,
  scenarios: ScriptIcon,
};

function exportEntityItems(
  model: Record<string, boolean>,
): CompactEntitySelectorItem[] {
  const selected = DATA_TRANSFER_ENTITIES.filter((entity) => model[entity]);
  const item = (
    value: Omit<CompactEntitySelectorItem, "disabled" | "meta"> & {
      id: DataTransferEntity;
    },
  ): CompactEntitySelectorItem => {
    const requiredBy = dataTransferRequiredBy(selected, value.id).filter(
      (entity) => entity !== value.id,
    );
    return {
      ...value,
      disabled: requiredBy.length > 0,
      metaIcons: requiredBy.map((entity) => ({
        icon: ENTITY_ICONS[entity],
        label: `Требуется для: ${ENTITY_LABELS[entity]}`,
      })),
    };
  };
  return [
    item({
      id: "secretCategories",
      title: "Категории секретов",
      description: "Структура категорий и их переносимые идентификаторы.",
      group: "Хранилище секретов",
    }),
    item({
      id: "secrets",
      title: "Секреты",
      description: "Названия и значения секретов вместе с категориями.",
      group: "Хранилище секретов",
    }),
    item({
      id: "terminalPolicy",
      title: "Работа с терминалом",
      description: "Ограничения, подтверждения и разрешённые команды.",
      group: "Политики",
    }),
    item({
      id: "memoryPolicy",
      title: "Память",
      description: "Автосохранение, лимиты и использование памяти.",
      group: "Политики",
    }),
    item({
      id: "skills",
      title: "Навыки",
      description: "Только пользовательские навыки, без системных.",
      group: "Автоматизация",
    }),
    item({
      id: "providers",
      title: "Провайдеры и модели",
      description: "Настройки провайдеров.",
      group: "Конфигурация",
    }),
    item({
      id: "integrations",
      title: "Интеграции",
      description: "Профили подключений без результатов проверки и истории.",
      group: "Конфигурация",
    }),
    item({
      id: "vectorStores",
      title: "Векторные хранилища",
      description: "Только настройки; документы и индексы не экспортируются.",
      group: "Конфигурация",
    }),
    item({
      id: "agents",
      title: "Агенты",
      description: "Инструкции, модели, навыки и доступные инструменты.",
      group: "Автоматизация",
    }),
    item({
      id: "scenarios",
      title: "Сценарии",
      description: "Активные графы и все необходимые зависимости.",
      group: "Автоматизация",
    }),
  ];
}

function ImportCountsCard({
  label,
  counts,
}: {
  label: string;
  counts: ImportPreview["categories"];
}) {
  const total = counts.create + counts.update + counts.conflict;
  return (
    <article className="rounded-lg border border-main-700/35 bg-main-900/35 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h5 className="text-xs font-medium text-main-200">{label}</h5>
        <span className="rounded-full bg-main-700/45 px-2 py-0.5 text-[10px] font-medium text-main-400">
          {total}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <ImportMetric
          label="Новые"
          value={counts.create}
          className="bg-success-medium/10 text-success-light"
        />
        <ImportMetric
          label="Обновятся"
          value={counts.update}
          className="bg-info-medium/10 text-info-light"
        />
        <ImportMetric
          label="Конфликты"
          value={counts.conflict}
          className="bg-warning-medium/10 text-warning-light"
        />
      </div>
    </article>
  );
}

function ImportMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-md px-2 py-1.5 ${className}`}>
      <span className="block text-sm font-semibold leading-none">{value}</span>
      <span className="mt-1 block truncate text-[10px] opacity-75">
        {label}
      </span>
    </div>
  );
}

function PoliciesImportCard({
  policies,
}: {
  policies: ImportPreview["policies"];
}) {
  const total = Number(policies.terminal) + Number(policies.memory);
  return (
    <article className="rounded-lg border border-main-700/35 bg-main-900/35 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h5 className="text-xs font-medium text-main-200">Политики</h5>
        <span className="rounded-full bg-main-700/45 px-2 py-0.5 text-[10px] font-medium text-main-400">
          {total}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <PolicyBadge label="Терминал" included={policies.terminal} />
        <PolicyBadge label="Память" included={policies.memory} />
      </div>
    </article>
  );
}

function PolicyBadge({
  label,
  included,
}: {
  label: string;
  included: boolean;
}) {
  return (
    <span
      className={`rounded-md px-2 py-1.5 text-[11px] font-medium ${
        included
          ? "bg-info-medium/10 text-info-light"
          : "bg-main-700/25 text-main-500"
      }`}
    >
      {label} · {included ? "обновится" : "нет в копии"}
    </span>
  );
}

function showError(
  toasts: ReturnType<typeof useToasts>,
  title: string,
  error: unknown,
) {
  toasts.danger({
    title,
    description: error instanceof Error ? error.message : "Неизвестная ошибка",
  });
}

function totalConflicts(preview: ImportPreview): number {
  return Math.max(
    preview.conflicts.length,
    Object.values(preview.entities).reduce(
      (sum, counts) => sum + (counts?.conflict ?? 0),
      0,
    ),
  );
}

function importResultDescription(result: ImportResult): string {
  const counts = Object.values(result.entities);
  const created = counts.reduce((sum, value) => sum + (value?.create ?? 0), 0);
  const updated =
    result.policies +
    counts.reduce((sum, value) => sum + (value?.update ?? 0), 0);
  return `Создано: ${created}, обновлено: ${updated}, пропущено: ${result.skipped}.`;
}
