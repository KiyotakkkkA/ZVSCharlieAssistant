import { Button, Modal, Switcher, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { BasicSelect } from "../../../atoms/basic";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import type { VectorDirectoryPreview } from "../../../../../ipc/contracts";
import { integrationStore } from "../../../../stores";
import {
  FileDocumentMultipleIcon,
  FolderIcon,
  FolderSearchIcon,
} from "../../../atoms";

type IndexMode = "documents" | "code";
type CodeSource = "local" | "connector";

interface StorageVecdbMultipleIndexFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (directoryPath: string) => void;
}

export const StorageVecdbMultipleIndexForm = observer(
  function StorageVecdbMultipleIndexForm({
    open,
    onClose,
    onSubmit,
  }: StorageVecdbMultipleIndexFormProps) {
    const toasts = useToasts();
    const [mode, setMode] = useState<IndexMode>("documents");
    const [source, setSource] = useState<CodeSource>("local");
    const [directory, setDirectory] = useState<VectorDirectoryPreview | null>(
      null,
    );
    const [connectorId, setConnectorId] = useState("");
    const [selecting, setSelecting] = useState(false);
    const connectors = useMemo(
      () =>
        integrationStore.profiles
          .filter(
            (profile) =>
              profile.enabled &&
              ["github_connector", "gitlab_connector"].includes(profile.kind),
          )
          .map((profile) => ({ value: profile.id, label: profile.name })),
      [integrationStore.profiles],
    );

    useEffect(() => {
      if (open) void integrationStore.bootstrap();
    }, [open]);

    const chooseDirectory = async () => {
      setSelecting(true);
      try {
        const preview = await window.desktop.vectorStores.selectDirectory(mode);
        if (preview) setDirectory(preview);
      } catch (error) {
        toasts.danger({
          title: "Не удалось прочитать папку",
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setSelecting(false);
      }
    };

    const close = () => {
      setMode("documents");
      setSource("local");
      setDirectory(null);
      setConnectorId("");
      onClose();
    };

    const confirm = () => {
      if (mode === "code") {
        toasts.warning({
          title: "В разработке…",
          description: "Индексация исходного кода будет доступна позже.",
        });
        close();
        return;
      }
      if (!directory) return;
      onSubmit(directory.path);
      close();
    };

    const canConfirm =
      mode === "documents"
        ? directory !== null && directory.supportedFiles > 0
        : source === "local"
          ? directory !== null
          : connectorId.length > 0;

    return (
      <Modal
        open={open}
        rounded="rounded-3xl"
        className="max-w-2xl overflow-hidden"
        onClose={close}
      >
        <Modal.Header>
          <div>
            <h2 className="text-base font-semibold text-main-50">
              Множественная загрузка
            </h2>
            <p className="mt-1 text-xs text-main-500">
              Выберите папку — поддерживаемые файлы из неё и всех подпапок
              попадут в индекс.
            </p>
          </div>
        </Modal.Header>
        <Modal.Content className="space-y-5">
          <FormRow
            title="Режим загрузки"
            description="Документы или исходный код"
          >
            <Switcher
              value={mode}
              label="Режим загрузки"
              rounded="rounded-full"
              options={[
                { value: "documents", label: "Обычный" },
                { value: "code", label: "Код" },
              ]}
              onChange={(value) => setMode(value as IndexMode)}
            />
          </FormRow>

          {mode === "code" ? (
            <FormRow title="Источник" description="Откуда получить код">
              <Switcher
                value={source}
                label="Источник кода"
                rounded="rounded-full"
                options={[
                  { value: "local", label: "Локальные файлы" },
                  { value: "connector", label: "Коннектор данных" },
                ]}
                onChange={(value) => setSource(value as CodeSource)}
              />
            </FormRow>
          ) : null}

          {mode === "documents" || source === "local" ? (
            <FormRow
              title="Папка"
              description={
                mode === "documents"
                  ? "PDF, DOCX и TXT во всех подпапках"
                  : "Локальный проект с исходным кодом"
              }
            >
              <Button
                variant="secondary"
                rounded="rounded-full"
                loading={selecting}
                disabled={selecting}
                className="px-2"
                onClick={() => void chooseDirectory()}
              >
                <FolderSearchIcon className="size-4" />
                Выбрать директорию
              </Button>
            </FormRow>
          ) : (
            <FormRow
              title="Коннектор"
              description="Подключение из раздела «Интеграции»"
            >
              <BasicSelect
                value={connectorId}
                onChange={setConnectorId}
                options={connectors}
                placeholder="Выберите коннектор"
                emptyMessage="Подходящих коннекторов нет"
                className="w-full"
                menuRounded="rounded-2xl"
              />
            </FormRow>
          )}

          {directory && (mode === "documents" || source === "local") ? (
            <DirectoryPreviewCard
              preview={directory}
              showDocumentStats={mode === "documents"}
            />
          ) : null}
        </Modal.Content>
        <Modal.Footer className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Отмена
          </Button>
          <Button
            variant="primary"
            rounded="rounded-full"
            disabled={!canConfirm || selecting}
            className="px-2"
            onClick={confirm}
          >
            Подтвердить
          </Button>
        </Modal.Footer>
      </Modal>
    );
  },
);

function FormRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gap-3 rounded-2xl bg-main-800/35 p-4 flex justify-between">
      <div>
        <p className="text-sm font-medium text-main-100">{title}</p>
        <p className="mt-1 text-xs text-main-500">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function DirectoryPreviewCard({
  preview,
  showDocumentStats,
}: {
  preview: VectorDirectoryPreview;
  showDocumentStats: boolean;
}) {
  return (
    <div className="rounded-2xl bg-main-800/35 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
          <FolderIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-main-100">
            {preview.name}
          </p>
          <p
            className="mt-1 truncate text-xs text-main-500"
            title={preview.path}
          >
            {preview.path}
          </p>
          {showDocumentStats ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-main-400">
              <span className="rounded-full bg-main-700/55 px-2.5 py-1">
                {preview.supportedFiles} поддерживаемых
              </span>
              <span className="rounded-full bg-main-700/55 px-2.5 py-1">
                {formatBytes(preview.totalBytes)}
              </span>
              {preview.ignoredFiles ? (
                <span className="rounded-full bg-warning-medium/10 px-2.5 py-1 text-warning-light">
                  Пропущено: {preview.ignoredFiles}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-main-400">
              Локальный проект выбран
            </p>
          )}
        </div>
      </div>
      {showDocumentStats && preview.examples.length ? (
        <div className="mt-4 border-t border-main-700/35 pt-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-main-400">
            <FileDocumentMultipleIcon className="size-4" />
            Пример содержимого
          </div>
          <ul className="space-y-1 text-xs text-main-500">
            {preview.examples.map((file) => (
              <li key={file} className="truncate" title={file}>
                {file}
              </li>
            ))}
          </ul>
        </div>
      ) : showDocumentStats ? (
        <p className="mt-4 text-xs text-warning-light">
          Поддерживаемые документы не найдены.
        </p>
      ) : null}
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}
