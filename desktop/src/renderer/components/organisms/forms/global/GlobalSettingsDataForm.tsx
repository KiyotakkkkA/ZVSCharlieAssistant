import { useState } from "react";
import {
  Alert,
  Button,
  InputCheckBox,
  InputSmall,
  Switcher,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  DataTransferConflictPolicy,
  ImportPreview,
} from "../../../../../shared/models/data-transfer";
import { DownloadIcon, GlobalSettingsLabel, UploadIcon } from "../../../atoms";
import {
  CompactEntitySelector,
  type CompactEntitySelectorItem,
} from "../../../molecules";
import {
  automationStore,
  memoryStore,
  secretStorageStore,
  terminalPolicyStore,
} from "../../../../stores";
import { DATA_ANCHORS } from "./settings-sections";

export function GlobalSettingsDataForm() {
  const toasts = useToasts();
  const [exportPassword, setExportPassword] = useState("");
  const [exportConfirmation, setExportConfirmation] = useState("");
  const [withoutEncryption, setWithoutEncryption] = useState(false);
  const [exportEntities, setExportEntities] = useState<Record<string, boolean>>(
    {
      secretCategories: true,
      secrets: true,
      terminalPolicy: true,
      memoryPolicy: true,
      skills: true,
    },
  );
  const [importPassword, setImportPassword] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [conflictPolicy, setConflictPolicy] =
    useState<DataTransferConflictPolicy>("skip");
  const [busy, setBusy] = useState<"export" | "prepare" | "commit" | null>(
    null,
  );

  const exportData = async () => {
    const entities = (
      [
        "secretCategories",
        "secrets",
        "terminalPolicy",
        "memoryPolicy",
        "skills",
      ] as const
    ).filter((entity) => exportEntities[entity]);
    if (!entities.length) {
      toasts.warning({ title: "Выберите данные для экспорта" });
      return;
    }
    if (!withoutEncryption && exportPassword.length < 8) {
      toasts.warning({ title: "Пароль должен содержать не менее 8 символов" });
      return;
    }
    if (!withoutEncryption && exportPassword !== exportConfirmation) {
      toasts.warning({ title: "Пароли не совпадают" });
      return;
    }
    setBusy("export");
    try {
      const saved = await window.desktop.dataTransfer.exportData({
        password: withoutEncryption ? "" : exportPassword,
        encryption: withoutEncryption ? "none" : "password",
        entities,
      });
      if (saved) {
        setExportPassword("");
        setExportConfirmation("");
        toasts.success({
          title: withoutEncryption
            ? "Копия создана"
            : "Защищённая копия создана",
        });
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
      ]);
      setPreview(null);
      toasts.success({
        title: "Импорт завершён",
        description: `Создано: ${result.categories.create + result.secrets.create + result.skills.create}, обновлено: ${result.categories.update + result.secrets.update + result.skills.update + result.policies}, пропущено: ${result.skipped}.`,
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

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <GlobalSettingsLabel {...DATA_ANCHORS.export} />
        <CompactEntitySelector
          items={exportEntityItems(Boolean(exportEntities.secrets))}
          model={exportEntities}
          searchPlaceholder="Найти данные"
          onModelChange={(model) =>
            setExportEntities(
              model.secrets ? { ...model, secretCategories: true } : model,
            )
          }
        />
        <InputCheckBox
          checked={withoutEncryption}
          onChange={(checked) => {
            setWithoutEncryption(checked);
            if (checked) {
              setExportPassword("");
              setExportConfirmation("");
            }
          }}
        >
          Не использовать пароль для шифрования
        </InputCheckBox>
        {withoutEncryption ? (
          <Alert variant="warning" title="Экспорт без защиты паролем">
            Значения секретов будут записаны в файл в открытом виде. Любой, кто
            получит доступ к файлу, сможет их прочитать.
          </Alert>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <PasswordField
              value={exportPassword}
              placeholder="Пароль шифрования"
              onChange={setExportPassword}
            />
            <PasswordField
              value={exportConfirmation}
              placeholder="Повторите пароль"
              onChange={setExportConfirmation}
            />
          </div>
        )}
        <div className="flex justify-end">
          <Button
            variant="primary"
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
          <PasswordField
            value={importPassword}
            placeholder="Пароль от копии, если он установлен"
            className="min-w-0 flex-1"
            onChange={setImportPassword}
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
              <ImportCountsCard
                label="Категории"
                counts={preview.categories}
              />
              <ImportCountsCard label="Секреты" counts={preview.secrets} />
              <ImportCountsCard label="Навыки" counts={preview.skills} />
              <PoliciesImportCard policies={preview.policies} />
            </div>
            {preview.conflicts.length || preview.skills.conflict ? (
              <Alert
                variant="warning"
                title={`Конфликты: ${preview.conflicts.length + preview.skills.conflict}`}
              >
                Выберите, пропустить существующие записи или обновить их данными
                из копии.
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
                  disabled={busy !== null}
                  onClick={() => void commitImport()}
                >
                  Импортировать
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function exportEntityItems(
  secretsSelected: boolean,
): CompactEntitySelectorItem[] {
  return [
    {
      id: "secretCategories",
      title: "Категории секретов",
      description: "Структура категорий и их переносимые идентификаторы.",
      group: "Хранилище секретов",
      disabled: secretsSelected,
      meta: secretsSelected ? "Требуется для экспорта секретов" : undefined,
    },
    {
      id: "secrets",
      title: "Секреты",
      description: "Названия и значения секретов вместе с категориями.",
      group: "Хранилище секретов",
    },
    {
      id: "terminalPolicy",
      title: "Работа с терминалом",
      description: "Ограничения, подтверждения и разрешённые команды.",
      group: "Политики",
    },
    {
      id: "memoryPolicy",
      title: "Память",
      description: "Автосохранение, лимиты и использование памяти.",
      group: "Политики",
    },
    {
      id: "skills",
      title: "Навыки",
      description: "Только пользовательские навыки, без системных.",
      group: "Автоматизация",
    },
  ];
}

function PasswordField({
  value,
  placeholder,
  className,
  onChange,
}: {
  value: string;
  placeholder: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <InputSmall
      type="password"
      autoComplete="new-password"
      value={value}
      placeholder={placeholder}
      maxLength={256}
      className={className ?? "w-full"}
      onChange={(event) => onChange(event.target.value)}
    />
  );
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

function PolicyBadge({ label, included }: { label: string; included: boolean }) {
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
