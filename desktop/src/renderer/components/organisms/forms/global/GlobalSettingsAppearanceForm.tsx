import {
  Button,
  InputSmall,
  Select,
  Switcher,
  useStyle,
  useToasts,
  type StyleThemePalette,
} from "@kiyotakkkka/zvs-uikit-lib";
import { useState } from "react";
import { GlobalSettingsLabel } from "../../../atoms";
import { APPEARANCE_ANCHORS } from "./settings-sections";
import {
  findPresetByPalette,
  saveThemePaletteToStorage,
} from "../../../../app/theme";
import {
  applyTypographyToDocument,
  loadTypographyFromStorage,
  saveTypographyToStorage,
  type FontSizeMode,
  type TypographySettings,
} from "../../../../app/typography";
import {
  DARK_THEME_PRESETS,
  LIGHT_THEME_PRESETS,
} from "../../../../../default/themes";
import { PrimaryButton } from "@renderer/components/atoms/buttons";

type ThemePreset = {
  value: string;
  label: string;
  palette: StyleThemePalette;
};

const FONT_SIZE_OPTIONS: Array<{ value: FontSizeMode; label: string }> = [
  { value: "small", label: "Мелкий" },
  { value: "normal", label: "Обычный" },
  { value: "large", label: "Крупный" },
  { value: "huge", label: "Огромный" },
];

export function GlobalSettingsAppearanceForm() {
  const { palette, changeTheme } = useStyle();
  const toasts = useToasts();
  const [typography, setTypography] = useState<TypographySettings>(
    loadTypographyFromStorage,
  );
  const [fontDraft, setFontDraft] = useState(typography.fontFamily);

  const applyPreset = (presets: ThemePreset[], value: string) => {
    const next = presets.find((preset) => preset.value === value);
    if (!next) return;
    changeTheme(next.palette);
    saveThemePaletteToStorage(next.palette);
  };
  const saveTypography = (next: TypographySettings) => {
    setTypography(next);
    saveTypographyToStorage(next);
    applyTypographyToDocument(next);
  };
  const saveFont = () => {
    saveTypography({ ...typography, fontFamily: fontDraft.trim() });
    toasts.success({ title: "Шрифт применён" });
  };

  return (
    <div className="space-y-8">
      <section>
        <GlobalSettingsLabel {...APPEARANCE_ANCHORS.colors} className="mb-4" />
        <div className="grid gap-6 grid-cols-2">
          <ThemeColumn
            title="Тёмная палитра"
            hint="Для работы при слабом освещении и повышенного контраста."
            value={
              findPresetByPalette(DARK_THEME_PRESETS, palette)?.value ?? ""
            }
            options={DARK_THEME_PRESETS}
            onChange={(value) => applyPreset(DARK_THEME_PRESETS, value)}
          />
          <ThemeColumn
            title="Светлая палитра"
            hint="Для дневного времени и снижения цветовой нагрузки."
            value={
              findPresetByPalette(LIGHT_THEME_PRESETS, palette)?.value ?? ""
            }
            options={LIGHT_THEME_PRESETS}
            onChange={(value) => applyPreset(LIGHT_THEME_PRESETS, value)}
          />
        </div>
      </section>

      <section>
        <GlobalSettingsLabel
          {...APPEARANCE_ANCHORS.typography}
          className="mb-4"
        />
        <div className="divide-y divide-main-700/35">
          <div className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
            <GlobalSettingsLabel
              {...APPEARANCE_ANCHORS.fontFamily}
              presentation="setting"
            />
            <div className="flex w-full gap-2 md:ml-auto md:w-auto md:shrink-0">
              <InputSmall
                value={fontDraft}
                placeholder="Например, Inter"
                maxLength={120}
                className="min-w-0 flex-1 md:w-72 md:flex-none"
                onChange={(event) => setFontDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && saveFont()}
              />
              <PrimaryButton
                variant="save"
                label="Сохранить"
                onClick={saveFont}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
            <GlobalSettingsLabel
              {...APPEARANCE_ANCHORS.fontSize}
              presentation="setting"
            />
            <Switcher
              value={typography.size}
              options={FONT_SIZE_OPTIONS}
              className="w-full shrink-0 md:w-auto"
              onChange={(value) =>
                saveTypography({ ...typography, size: value as FontSizeMode })
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingDescription({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-w-0 md:pr-8">
      <h3 className="text-sm font-medium text-main-100">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-main-400">{description}</p>
    </div>
  );
}

function ThemeColumn({
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
  const active = options.find((option) => option.value === value) ?? options[0];
  return (
    <article className="min-w-0 py-3">
      <SettingDescription title={title} description={hint} />
      <Select
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Выберите палитру"
        className="my-3! w-full!"
      >
        <Select.Trigger />
        <Select.Menu>
          {options.map(({ value: optionValue, label }) => (
            <Select.Option
              key={optionValue}
              value={optionValue}
              label={label}
            />
          ))}
        </Select.Menu>
      </Select>
      {active ? <PalettePreview palette={active.palette} /> : null}
    </article>
  );
}

function PalettePreview({ palette }: { palette: StyleThemePalette }) {
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
            className="size-2 rounded-full"
            style={{ backgroundColor: palette.danger.medium }}
          />
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: palette.warning.medium }}
          />
          <span
            className="size-2 rounded-full"
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
            <span
              className="h-8 rounded"
              style={{ backgroundColor: `${palette.info.medium}22` }}
            />
            <span
              className="h-8 rounded"
              style={{ backgroundColor: `${palette.accent.medium}22` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(["success", "warning", "danger"] as const).map((key) => (
            <span
              key={key}
              className="h-6 rounded"
              style={{ backgroundColor: `${palette[key].medium}2e` }}
            />
          ))}
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
