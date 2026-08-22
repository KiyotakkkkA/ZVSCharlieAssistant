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
import { secretStorageStore } from "../../../../stores";
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
    const entities = (["secretCategories", "secrets"] as const).filter(
      (entity) => exportEntities[entity],
    );
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
      await secretStorageStore.bootstrap(true);
      setPreview(null);
      toasts.success({
        title: "Импорт завершён",
        description: `Создано: ${result.categories.create + result.secrets.create}, обновлено: ${result.categories.update + result.secrets.update}, пропущено: ${result.skipped}.`,
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
              <p className="mt-1 text-xs text-main-400">
                Категории: {describeCounts(preview.categories)}. Секреты:{" "}
                {describeCounts(preview.secrets)}.
              </p>
            </div>
            {preview.conflicts.length ? (
              <Alert
                variant="warning"
                title={`Конфликты: ${preview.conflicts.length}`}
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

function describeCounts(counts: ImportPreview["categories"]): string {
  return `${counts.create} новых, ${counts.update} обновляемых, ${counts.conflict} конфликтов`;
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
