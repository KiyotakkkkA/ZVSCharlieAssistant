import { useMemo, useState } from "react";
import {
  InputCheckBox,
  InputCheckBoxGroup,
  InputSmall,
  ScrollArea,
  Tooltip,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { SvgIcon } from "../atoms";

export interface CompactEntitySelectorMetaIcon {
  icon: SvgIcon;
  label: string;
}

export interface CompactEntitySelectorItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  group?: string;
  disabled?: boolean;
  metaIcons?: CompactEntitySelectorMetaIcon[];
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
          className="min-w-64 flex-1"
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
            className="space-y-0"
          >
            {groups.map(([group, entries]) => (
              <div key={group} className="w-full">
                {groups.length > 1 || group !== "Все" ? (
                  <div className="sticky top-0 z-10 bg-main-900/95 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-main-500 backdrop-blur">
                    {group} · {entries.length}
                  </div>
                ) : null}
                <div className="w-full space-y-1.5 p-2">
                  {entries.map((item) => (
                    <div key={item.id} className="relative w-full">
                      <InputCheckBox
                        modelValue={item.id}
                        disabled={item.disabled}
                        className="w-full rounded-lg px-2! transition-colors hover:bg-main-700/35"
                        classNames={{
                          content: item.metaIcons?.length
                            ? `min-w-0 flex-1 ${metaPaddingClass(item.metaIcons.length)}`
                            : item.meta
                              ? "min-w-0 flex-1 pr-36"
                              : "min-w-0 flex-1",
                        }}
                      >
                        <span className="block min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-main-100">
                            {item.title}
                          </span>
                          {item.description ? (
                            <span className="mt-0.5 block wrap-break-word text-xs leading-relaxed text-main-500">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      </InputCheckBox>
                      {item.metaIcons?.length ? (
                        <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                          {item.metaIcons.map(
                            ({ icon: Icon, label }, index) => (
                              <Tooltip
                                key={`${label}-${index}`}
                                label={label}
                                placement="left-center"
                              >
                                <span
                                  tabIndex={0}
                                  aria-label={label}
                                  className="grid size-6 shrink-0 place-items-center rounded-md text-main-500 outline-none transition-colors hover:bg-main-700/45 hover:text-main-200 focus-visible:bg-main-700/45 focus-visible:text-main-200"
                                >
                                  <Icon className="size-3.5" />
                                </span>
                              </Tooltip>
                            ),
                          )}
                        </span>
                      ) : item.meta ? (
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] text-main-500">
                          {item.meta}
                        </span>
                      ) : null}
                    </div>
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

function metaPaddingClass(count: number): string {
  if (count <= 1) return "pr-12";
  if (count === 2) return "pr-20";
  if (count === 3) return "pr-28";
  if (count === 4) return "pr-36";
  return "pr-48";
}
