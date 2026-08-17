import { Select, Separator, Tabs, useStyle } from "@kiyotakkkka/zvs-uikit-lib";
import { PageHeader } from "../../../components/organisms";
import {
  DARK_THEME_PRESETS,
  LIGHT_THEME_PRESETS,
  clearThemePaletteStorage,
  findPresetByPalette,
  saveThemePaletteToStorage,
} from "../../../app/theme";
import { useState } from "react";

type ThemePreset = {
  value: string;
  label: string;
  palette: import("@kiyotakkkka/zvs-uikit-lib").StyleThemePalette;
};

type AppearanceTab = "colors";

function ThemeVisualPreview({ palette }: { palette: ThemePreset["palette"] }) {
  return (
    <div
      className="mt-2 overflow-hidden rounded-md border"
      style={{
        borderColor: `${palette.main[700]}66`,
        backgroundColor: palette.main[900],
        color: palette.main[100],
      }}
    >
      <div
        className="flex items-center justify-between border-b px-2.5 py-1.5"
        style={{ borderColor: `${palette.main[700]}66` }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: palette.danger.medium }}
          />
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: palette.warning.medium }}
          />
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: palette.success.medium }}
          />
        </div>
        <span className="text-[10px]" style={{ color: palette.main[400] }}>
          Preview
        </span>
      </div>

      <div className="space-y-2 p-2">
        <div
          className="rounded px-2 py-1.5"
          style={{ backgroundColor: `${palette.main[800]}dd` }}
        >
          <div
            className="mb-1.5 h-1.5 w-20 rounded-full"
            style={{ backgroundColor: palette.main[500] }}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <div
              className="h-8 rounded"
              style={{ backgroundColor: `${palette.info.medium}22` }}
            />
            <div
              className="h-8 rounded"
              style={{ backgroundColor: `${palette.accent.medium}22` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div
            className="h-6 rounded"
            style={{ backgroundColor: `${palette.success.medium}2e` }}
          />
          <div
            className="h-6 rounded"
            style={{ backgroundColor: `${palette.warning.medium}2e` }}
          />
          <div
            className="h-6 rounded"
            style={{ backgroundColor: `${palette.danger.medium}2e` }}
          />
        </div>

        <div
          className="flex items-center justify-between rounded px-2 py-1.5"
          style={{ backgroundColor: `${palette.main[800]}cc` }}
        >
          <span className="text-[10px]" style={{ color: palette.main[300] }}>
            Status: synced
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${palette.accent.medium}2b`,
              color: palette.accent.light,
            }}
          >
            Active
          </span>
        </div>
      </div>
    </div>
  );
}

function ThemeSelectorCard({
  title,
  hint,
  value,
  options,
  onChange,
}: {
  title: string;
  hint: string;
  value: string;
  options: ThemePreset[];
  onChange: (value: string) => void;
}) {
  const active = options.find((option) => option.value === value) ?? null;
  const previewPalette = active?.palette ?? options[0]?.palette;

  return (
    <article className="rounded-lg border border-main-700/40 bg-main-800/30 p-3">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-main-100">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-main-400">{hint}</p>
      </div>

      <Select
        value={value}
        onChange={onChange}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        placeholder="Выберите палитру"
        className="w-full"
      >
        <Select.Trigger className="w-full" />
        <Select.Menu>
          {options.map((option) => (
            <Select.Option
              key={option.value}
              value={option.value}
              label={option.label}
            />
          ))}
        </Select.Menu>
      </Select>

      {previewPalette ? <ThemeVisualPreview palette={previewPalette} /> : null}
    </article>
  );
}

export const SettingsAppearancePage = () => {
  const { palette, changeTheme } = useStyle();
  const [tab, setTab] = useState<AppearanceTab>("colors");

  const activeDark =
    findPresetByPalette(DARK_THEME_PRESETS, palette)?.value ?? "";
  const activeLight =
    findPresetByPalette(LIGHT_THEME_PRESETS, palette)?.value ?? "";

  const applyPreset = (presets: ThemePreset[], value: string) => {
    const next = presets.find((preset) => preset.value === value);
    if (!next) return;

    changeTheme(next.palette);
    saveThemePaletteToStorage(next.palette);
  };

  return (
    <section className="flex h-full min-h-0 flex-col p-4">
      <PageHeader
        title="Внешний вид"
        description="Настройте интерфейс приложения для максимально комфортной работы."
        breadcrumbs={[{ label: "Настройки" }, { label: "Внешний вид" }]}
        footer={
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
            options={[
              {
                value: "colors",
                label: `Цветовые схемы`,
              },
            ]}
          />
        }
      />

      {tab === "colors" && (
        <div className="rounded-xl bg-main-900/10 p-2">
          <div className="font-medium mb-3">Цветовая палитра приложения</div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <ThemeSelectorCard
                title="Тёмная"
                hint="Для работы при слабом освещении и повышенного контраста."
                value={activeDark}
                options={DARK_THEME_PRESETS}
                onChange={(value) => applyPreset(DARK_THEME_PRESETS, value)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <ThemeSelectorCard
                title="Светлая"
                hint="Для дневного режима и снижения цветовой нагрузки."
                value={activeLight}
                options={LIGHT_THEME_PRESETS}
                onChange={(value) => applyPreset(LIGHT_THEME_PRESETS, value)}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
