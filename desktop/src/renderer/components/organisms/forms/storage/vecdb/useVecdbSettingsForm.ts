import { useMemo, useState } from "react";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import {
  textProviderStore,
  vectorStoreStore,
  type VectorStoreModel,
} from "@renderer/stores";
import { humanizeError } from "@renderer/lib/plain-language";

const MIN_CHUNK_TOKENS = 100;
const MAX_CHUNK_TOKENS = 4096;

export interface VecdbSettingsForm {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  embeddingModelId: string;
  setEmbeddingModelId: (value: string) => void;
  searchMode: VectorStoreModel["searchMode"];
  setSearchMode: (value: VectorStoreModel["searchMode"]) => void;
  chunkSize: string;
  setChunkSize: (value: string) => void;
  chunkOverlap: string;
  setChunkOverlap: (value: string) => void;
  embeddingModels: typeof textProviderStore.models;
  valid: boolean;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

export function useVecdbSettingsForm(
  model: VectorStoreModel,
): VecdbSettingsForm {
  const toasts = useToasts();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description);
  const [embeddingModelId, setEmbeddingModelId] = useState(
    model.embeddingModelId ? String(model.embeddingModelId) : "",
  );
  const [searchMode, setSearchMode] = useState(model.searchMode);
  const [chunkSize, setChunkSize] = useState(String(model.chunkSizeTokens));
  const [chunkOverlap, setChunkOverlap] = useState(
    String(model.chunkOverlapTokens),
  );

  const embeddingModels = useMemo(
    () =>
      textProviderStore.models.filter((item) => {
        const provider = textProviderStore.providers.find(
          (entry) => entry.id === item.providerId,
        );
        return (
          item.enabled &&
          provider?.enabled &&
          provider.providerType === "embedding"
        );
      }),
    [textProviderStore.models, textProviderStore.providers],
  );

  const parsedChunkSize = Number(chunkSize);
  const parsedChunkOverlap = Number(chunkOverlap);
  const valid =
    name.trim().length > 0 &&
    Number.isInteger(parsedChunkSize) &&
    parsedChunkSize >= MIN_CHUNK_TOKENS &&
    parsedChunkSize <= MAX_CHUNK_TOKENS &&
    Number.isInteger(parsedChunkOverlap) &&
    parsedChunkOverlap >= 0 &&
    parsedChunkOverlap <= parsedChunkSize / 2;
  const dirty =
    name.trim() !== model.name ||
    description !== model.description ||
    embeddingModelId !== (model.embeddingModelId ?? "") ||
    searchMode !== model.searchMode ||
    parsedChunkSize !== model.chunkSizeTokens ||
    parsedChunkOverlap !== model.chunkOverlapTokens;

  const save = async () => {
    if (!valid || !dirty) return;
    setSaving(true);
    try {
      const normalizedName = name.trim();
      await vectorStoreStore.updateStore(model.id, {
        name: normalizedName,
        description,
        embeddingModelId: embeddingModelId || null,
        searchMode,
        chunkSizeTokens: parsedChunkSize,
        chunkOverlapTokens: parsedChunkOverlap,
      });
      setName(normalizedName);
      toasts.success({
        title: "Настройки сохранены",
        description: "Векторное хранилище обновлено.",
      });
    } catch (error) {
      toasts.danger({
        title: "Не удалось сохранить",
        description: humanizeError(error),
      });
    } finally {
      setSaving(false);
    }
  };

  return {
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
    valid,
    dirty,
    saving,
    save,
  };
}
