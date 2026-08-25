import { observer } from "mobx-react-lite";
import { Select, type SelectProps } from "@kiyotakkkka/zvs-uikit-lib";
import { secretStorageStore } from "../../stores";

interface SecretOrientedSelectProps extends Omit<
  SelectProps,
  "children" | "options"
> {
  categoryId: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
}

export const SecretOrientedSelect = observer(function SecretOrientedSelect({
  categoryId,
  className,
  triggerClassName,
  menuClassName,
  optionClassName,
  emptyMessage = "В категории нет доступных секретов",
  ...selectProps
}: SecretOrientedSelectProps) {
  const options = secretStorageStore.secrets
    .filter((secret) => secret.categoryId === categoryId)
    .map((secret) => ({ value: String(secret.id), label: secret.label }));

  return (
    <Select
      {...selectProps}
      options={options}
      emptyMessage={emptyMessage}
      className={className}
      searchable
      classNames={{ search: "mb-3" }}
    >
      <Select.Trigger className={triggerClassName} />
      <Select.Menu className={menuClassName}>
        {options.map((option) => (
          <Select.Option
            key={option.value}
            {...option}
            className={optionClassName}
          />
        ))}
      </Select.Menu>
    </Select>
  );
});
