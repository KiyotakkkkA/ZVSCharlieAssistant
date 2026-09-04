import { observer } from "mobx-react-lite";
import {
  Button,
  InputBig,
  InputSmall,
  ProgressBar,
  ScrollArea,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { BasicAlert } from "@renderer/components/atoms/basic";
import { Field, Lead, ParameterLabel } from "@renderer/components/atoms";
import { BasicSelect } from "@renderer/components/atoms/basic";
import { textProviderStore, vectorStoreStore } from "@renderer/stores";
import { useDownload } from "@renderer/hooks";
import { BUILTIN_EMBEDDING_MODEL_IDS } from "../../../../../../shared/entity-ids";
import type { VecdbSettingsForm } from "./useVecdbSettingsForm";

interface VecdbSettingsTabProps {
  form: VecdbSettingsForm;
  documentCount: number;
}

export const VecdbSettingsTab = observer(function VecdbSettingsTab({
  form,
  documentCount,
}: VecdbSettingsTabProps) {
  const toasts = useToasts();
  const localModel = useDownload("embedding");
  const {
    name,
    setName,
    description,
    setDescription,
    embeddingModelId,
    setEmbeddingModelId,
    searchMode,
    setSearchMode,
    chunkSize,
    setChunkSize,
    chunkOverlap,
    setChunkOverlap,
    embeddingModels,
  } = form;

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div
        data-tour="knowledge-settings"
        className="grid gap-5 p-5 xl:grid-cols-[220px_minmax(0,1fr)]"
      >
        <Lead
          title="Основное"
          description="Основная информация о базе данных"
        />
        <div className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-1">
          <Field
            label={
              <ParameterLabel description="Отображаемое название базы знаний в списках, настройках агентов и узлах сценария.">
                Название
              </ParameterLabel>
            }
          >
            <InputSmall
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Кратко объясняет назначение и состав базы знаний, чтобы отличать её от других хранилищ.">
                Описание
              </ParameterLabel>
            }
          >
            <InputBig
              value={description}
              classNames={{
                textarea: "resize-none",
              }}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
        <Lead
          title="Векторизация"
          description="Embedding-модель и параметры разбиения фиксируются для загруженных документов. Для их смены сначала очистите хранилище."
        />
        <div className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-2">
          <Field
            label={
              <ParameterLabel description="Преобразует фрагменты документов и поисковые запросы в числовые векторы. Для одного индекса должна использоваться одна модель.">
                Embedding-модель
              </ParameterLabel>
            }
            className="md:col-span-2"
          >
            <BasicSelect
              value={embeddingModelId}
              onChange={setEmbeddingModelId}
              className="w-full"
              disabled={documentCount > 0}
              options={[
                {
                  value: BUILTIN_EMBEDDING_MODEL_IDS.bgeM3,
                  label: localModel.installed
                    ? "Локальная модель (bge-m3) · на этом компьютере"
                    : "Локальная модель (bge-m3) · требует загрузки",
                },
                ...embeddingModels.map((item) => ({
                  value: String(item.id),
                  label: textProviderStore.modelLabel(item.id),
                })),
              ]}
              placeholder="Выберите embedding-модель"
              searchable
              classNames={{ search: "mb-3" }}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Максимальный размер одного фрагмента в приблизительных токенах. Большие чанки сохраняют больше контекста, но могут снижать точность поиска.">
                Размер чанка
              </ParameterLabel>
            }
          >
            <InputSmall
              type="number"
              min={100}
              max={4096}
              disabled={documentCount > 0}
              value={chunkSize}
              onChange={(event) => setChunkSize(event.target.value)}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Количество токенов, повторяющихся между соседними чанками. Помогает не потерять смысл на границе фрагментов.">
                Перекрытие
              </ParameterLabel>
            }
          >
            <InputSmall
              type="number"
              min={0}
              disabled={documentCount > 0}
              value={chunkOverlap}
              onChange={(event) => setChunkOverlap(event.target.value)}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Определяет способ отбора и ранжирования фрагментов при запросе к базе знаний.">
                Режим поиска
              </ParameterLabel>
            }
            className="md:col-span-2 w-fit"
          >
            <BasicSelect
              value={searchMode}
              onChange={(value) => setSearchMode(value as "vector" | "hybrid")}
              options={[
                { value: "vector", label: "Векторный" },
                { value: "hybrid", label: "Гибридный" },
              ]}
            />
          </Field>
          <BasicAlert
            variant="info"
            title={
              searchMode === "vector" ? "Векторный поиск" : "Гибридный поиск"
            }
            className="md:col-span-2"
          >
            {searchMode === "vector"
              ? "Программа ищет по смыслу: находит фрагменты, близкие к запросу, даже если слова в них другие."
              : "Программа ищет и по смыслу, и по точным словам одновременно, а затем объединяет результаты. Так лучше находятся названия, термины, артикулы и точные формулировки."}
          </BasicAlert>
        </div>
      </div>
    </ScrollArea>
  );
});
