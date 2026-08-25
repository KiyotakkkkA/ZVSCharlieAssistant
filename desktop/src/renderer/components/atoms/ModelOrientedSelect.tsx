import { Select, type SelectProps } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { textProviderStore } from "../../stores";

type ModelOrientedSelectVariant = "ghost" | "select";

interface ModelOrientedSelectProps extends Omit<
  SelectProps,
  "children" | "options" | "variant"
> {
  variant?: ModelOrientedSelectVariant;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
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
    <Select
      {...selectProps}
      options={options}
      className={`${ghost && "w-fit! shrink-0"} ${className ?? ""}`}
      placeholder={options.length ? placeholder : emptyMessage}
      emptyMessage={emptyMessage}
      disabled={selectProps.disabled || options.length === 0}
      searchable
      classNames={{ search: "mb-3" }}
    >
      <Select.Trigger
        rounded={ghost ? "rounded-full" : undefined}
        className={`${
          ghost &&
          "h-9 border-0! px-3 text-xs shadow-none ring-0! hover:bg-main-600/70"
        } ${triggerClassName ?? ""}`}
      />
      <Select.Menu
        rounded={ghost ? "rounded-3xl" : undefined}
        className={menuClassName}
      >
        {options.map((option) => (
          <Select.Option
            key={option.value}
            {...option}
            rounded={ghost ? "rounded-full" : undefined}
            className={optionClassName}
          />
        ))}
      </Select.Menu>
    </Select>
  );
});
