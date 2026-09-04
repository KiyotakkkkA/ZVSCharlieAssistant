import { observer } from "mobx-react-lite";
import { textProviderStore } from "../../stores";
import { BasicSelect, type BasicSelectProps } from "./basic";

type ModelOrientedSelectVariant = "ghost" | "select";

interface ModelOrientedSelectProps extends Omit<BasicSelectProps, "options"> {
  variant?: ModelOrientedSelectVariant;
}

const PROVIDER_LABELS = {
  ollama: "Ollama",
  openrouter: "OpenRouter",
  mistral: "Mistral",
} as const;

export const ModelOrientedSelect = observer(function ModelOrientedSelect({
  variant = "select",
  className,
  triggerClassName,
  menuClassName,
  optionClassName,
  emptyMessage = "Нет доступных моделей",
  placeholder = "Выберите модель",
  ...selectProps
}: ModelOrientedSelectProps) {
  const options = textProviderStore.enabledModels.map((model) => {
    const provider = textProviderStore.providers.find(
      (item) => item.id === model.providerId,
    );
    return {
      value: String(model.id),
      label: `${provider ? PROVIDER_LABELS[provider.kind] : "Провайдер"} · ${model.name}`,
    };
  });
  const ghost = variant === "ghost";

  return (
    <BasicSelect
      {...selectProps}
      options={options}
      className={`${ghost ? "w-fit! shrink-0" : ""} ${className ?? ""}`.trim()}
      placeholder={options.length ? placeholder : emptyMessage}
      emptyMessage={emptyMessage}
      disabled={selectProps.disabled || options.length === 0}
      searchable
      classNames={{ search: "mb-3" }}
      triggerRounded={ghost ? "rounded-full" : undefined}
      triggerClassName={`${
        ghost
          ? "h-9 border-0! px-3 text-xs shadow-none ring-0! hover:bg-main-600/70"
          : ""
      } ${triggerClassName ?? ""}`.trim()}
      menuRounded={ghost ? "rounded-3xl" : undefined}
      menuClassName={menuClassName}
      optionRounded={ghost ? "rounded-full" : undefined}
      optionClassName={optionClassName}
    />
  );
});
