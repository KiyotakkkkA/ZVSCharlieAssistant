import { InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { useMemo, useState } from "react";
import {
  PaletteIcon,
  useGlobalSettings,
  type GlobalSettingRegistration,
} from "../atoms";

export function GlobalSettingsSidebar() {
  const [query, setQuery] = useState("");
  const { items, activeFormId, navigate } = useGlobalSettings();
  const forms = items.filter(({ level }) => level === "form");
  const anchors = items.filter(
    ({ level, parentId }) => level === "anchor" && parentId === activeFormId,
  );
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return items.filter((item) =>
      [item.label, item.description, ...item.keywords]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [items, query]);

  const select = (id: string) => {
    navigate(id);
    setQuery("");
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-main-700/30 p-3">
      <div className="relative z-20">
        <InputSmall
          preset="search"
          value={query}
          placeholder="Найти настройку"
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
        />
        {query ? (
          <NavigationList
            items={results}
            activeId={activeFormId}
            floating
            emptyLabel="Настройки не найдены"
            onSelect={select}
          />
        ) : null}
      </div>

      <p className="mb-2 mt-5 px-2 text-[10px] font-medium uppercase tracking-wider text-main-500">
        Настройки
      </p>
      <NavigationList items={forms} activeId={activeFormId} onSelect={select} />

      {anchors.length ? (
        <>
          <p className="mb-1 mt-5 px-2 text-[10px] font-medium uppercase tracking-wider text-main-500">
            На этой странице
          </p>
          <NavigationList items={anchors} activeId={null} onSelect={select} />
        </>
      ) : null}
    </aside>
  );
}

function NavigationList({
  items,
  activeId,
  floating = false,
  emptyLabel,
  onSelect,
}: {
  items: GlobalSettingRegistration[];
  activeId: string | null;
  floating?: boolean;
  emptyLabel?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className={
        floating
          ? "absolute left-0 right-0 top-[calc(100%+0.35rem)] max-h-80 overflow-y-auto rounded-xl border border-main-700/45 bg-main-900 p-1.5 shadow-2xl shadow-black/45"
          : "space-y-1"
      }
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className={`flex w-full items-start gap-2.5 rounded-lg text-left transition-colors px-2.5 py-2
            ${
              active
                ? "bg-main-700/50 text-main-50"
                : "text-main-300 hover:bg-main-700/25 hover:text-main-50"
            }`}
            onClick={() => onSelect(item.id)}
          >
            {Icon && (
              <Icon className="mt-0.5 size-3.5 shrink-0 text-main-400" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {item.label}
              </span>
              {!(item.level === "form") ? (
                <span className="mt-0.5 block truncate text-xs text-main-500">
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
      {!items.length && emptyLabel ? (
        <p className="px-3 py-4 text-center text-xs text-main-500">
          {emptyLabel}
        </p>
      ) : null}
    </div>
  );
}
