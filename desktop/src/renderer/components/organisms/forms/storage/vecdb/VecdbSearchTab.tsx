import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  InputSmall,
  ScrollArea,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { SearchIcon } from "@renderer/components/atoms";
import { vectorStoreStore, type VectorStoreModel } from "@renderer/stores";
import type { VectorSearchResultItem } from "@ipc/contracts";
import { humanizeError } from "@renderer/lib/plain-language";

interface VecdbSearchTabProps {
  model: VectorStoreModel;
  documentCount: number;
}

export const VecdbSearchTab = observer(function VecdbSearchTab({
  model,
  documentCount,
}: VecdbSearchTabProps) {
  const toasts = useToasts();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<VectorSearchResultItem[]>([]);

  useEffect(() => {
    if (!documentCount) setResults([]);
  }, [documentCount]);

  return (
    <div
      data-tour="knowledge-search"
      className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col"
    >
      <div className="flex gap-2 p-5 pb-4">
        <InputSmall
          className="w-lg"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Введите запрос для проверки..."
        />
        <Button
          variant="secondary"
          loading={searching}
          className="px-2"
          disabled={!query.trim() || searching}
          onClick={() => {
            setSearching(true);
            void vectorStoreStore
              .search({ vectorStoreIds: [model.id], query, limit: 5 })
              .then(setResults)
              .catch((error) =>
                toasts.danger({
                  title: "Ошибка поиска",
                  description: humanizeError(error),
                }),
              )
              .finally(() => setSearching(false));
          }}
        >
          <SearchIcon className="size-4" />
          Найти
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 pb-5">
          {results.length ? (
            <div className="space-y-2">
              {results.map((item) => (
                <article
                  key={`${item.documentId}:${item.chunkIndex}`}
                  className="rounded-xl bg-main-800/45 p-4 ring-1 ring-main-700/35"
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-main-200">
                      {item.fileName}
                    </span>
                    <span className="text-accent-light">
                      {Math.round(item.score * 100)}%
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-main-400">
                    {item.content}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-main-700 text-center">
              <div>
                <SearchIcon className="mx-auto size-6 text-main-500" />
                <p className="mt-3 text-sm text-main-300">
                  Результаты поиска появятся здесь
                </p>
                <p className="mt-1 text-xs text-main-500">
                  Введите запрос, чтобы проверить индекс и релевантность
                  фрагментов.
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
