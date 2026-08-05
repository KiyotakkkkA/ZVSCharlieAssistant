import { useMemo, useState } from "react";
import {
  InputCheckBox,
  InputCheckBoxGroup,
  InputSmall,
  ScrollArea,
} from "@kiyotakkkka/zvs-uikit-lib";

export interface CompactEntitySelectorItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  group?: string;
  disabled?: boolean;
}

interface CompactEntitySelectorProps {
  items: CompactEntitySelectorItem[];
  model: Record<string, boolean>;
  onModelChange: (model: Record<string, boolean>) => void;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

export function CompactEntitySelector({
  items,
  model,
  onModelChange,
  searchPlaceholder = "Найти",
  emptyLabel = "Ничего не найдено",
}: CompactEntitySelectorProps) {
  const [query, setQuery] = useState("");
  const selectedCount = Object.values(model).filter(Boolean).length;
  const groups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = normalized
      ? items.filter((item) =>
          [item.title, item.description, item.meta, item.group]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalized),
        )
      : items;
    return Array.from(
      Map.groupBy(filtered, (item) => item.group ?? "Все").entries(),
    );
  }, [items, query]);

  return (
    <div className="overflow-hidden rounded-xl border border-main-700/45 bg-main-900/20">
      <div className="flex items-center gap-3 border-b border-main-700/35 p-2.5">
        <InputSmall
          preset="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1"
        />
        <span className="shrink-0 rounded-full bg-main-700/55 px-2.5 py-1 text-xs text-main-300">
          {selectedCount} из {items.length}
        </span>
      </div>

      <ScrollArea className="max-h-64">
        {groups.length ? (
          <InputCheckBoxGroup
            model={model}
            onModelChange={onModelChange}
            multiple
            orientation="vertical"
            className="space-y-0 p-1.5"
          >
            {groups.map(([group, entries]) => (
              <div key={group} className="mb-1 last:mb-0">
                {groups.length > 1 || group !== "Все" ? (
                  <div className="sticky top-0 z-10 bg-main-900/95 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-main-500 backdrop-blur">
                    {group} · {entries.length}
                  </div>
                ) : null}
                <div className="space-y-0.5">
                  {entries.map((item) => (
                    <InputCheckBox
                      key={item.id}
                      modelValue={item.id}
                      disabled={item.disabled}
                      className="w-full rounded-lg px-2.5 py-2 transition-colors hover:bg-main-700/35"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-main-100">
                            {item.title}
                          </span>
                          {item.description ? (
                            <span className="mt-0.5 block truncate text-xs text-main-500">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                        {item.meta ? (
                          <span className="shrink-0 text-[11px] text-main-500">
                            {item.meta}
                          </span>
                        ) : null}
                      </span>
                    </InputCheckBox>
                  ))}
                </div>
              </div>
            ))}
          </InputCheckBoxGroup>
        ) : (
          <div className="grid min-h-28 place-items-center px-4 text-sm text-main-500">
            {emptyLabel}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
