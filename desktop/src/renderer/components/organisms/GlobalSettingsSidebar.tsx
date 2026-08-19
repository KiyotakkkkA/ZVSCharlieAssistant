import { InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useGlobalSettings } from "../atoms";

interface SearchEntry {
  id: string;
  label: string;
  description: string;
}

interface SearchGroup {
  id: string;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  children: SearchEntry[];
}

export function GlobalSettingsSidebar() {
  const [query, setQuery] = useState("");
  const { forms, activeFormId, navigate } = useGlobalSettings();

  const groups = useMemo<SearchGroup[]>(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    const hit = (parts: Array<string | undefined>) =>
      parts.filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);

    return forms.flatMap((form) => {
      const matched = hit([
        form.label,
        form.description,
        ...(form.keywords ?? []),
      ]);
      const children = (form.anchors ?? [])
        .filter((anchor) =>
          hit([anchor.label, anchor.description, ...(anchor.keywords ?? [])]),
        )
        .map((anchor) => ({
          id: anchor.id,
          label: anchor.label,
          description: anchor.description ?? "",
        }));
      if (!matched && !children.length) return [];
      return [{ id: form.id, label: form.label, icon: form.icon, children }];
    });
  }, [forms, query]);

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
          classNames={{
            trailingButton: "rounded-full",
          }}
        />
        {query ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] max-h-80 space-y-2 overflow-y-auto rounded-xl border border-main-700/45 bg-main-900 p-1.5 shadow-2xl shadow-black/45">
            {groups.map((group) => (
              <div key={group.id}>
                <NavigationRow
                  label={group.label}
                  icon={group.icon}
                  active={group.id === activeFormId}
                  onClick={() => select(group.id)}
                />
                {group.children.map((child) => (
                  <NavigationRow
                    key={child.id}
                    label={child.label}
                    description={child.description}
                    nested
                    onClick={() => select(child.id)}
                  />
                ))}
              </div>
            ))}
            {!groups.length ? (
              <p className="px-3 py-4 text-center text-xs text-main-500">
                Настройки не найдены
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mb-2 mt-5 px-2 text-[10px] font-medium uppercase tracking-wider text-main-500">
        Настройки
      </p>
      <div className="space-y-1">
        {forms.map((form) => (
          <NavigationRow
            key={form.id}
            label={form.label}
            icon={form.icon}
            active={form.id === activeFormId}
            onClick={() => select(form.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function NavigationRow({
  label,
  description,
  icon: Icon,
  active = false,
  nested = false,
  onClick,
}: {
  label: string;
  description?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  active?: boolean;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors
      ${nested ? "pl-8" : ""}
      ${
        active
          ? "bg-main-700/50 text-main-50"
          : "text-main-300 hover:bg-main-700/25 hover:text-main-50"
      }`}
    >
      {Icon ? <Icon className="mt-0.5 size-3.5 shrink-0 text-main-400" /> : null}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-main-500">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
