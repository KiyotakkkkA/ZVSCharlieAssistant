import { observer } from "mobx-react-lite";
import { secretStorageStore } from "../../stores";
import { BasicSelect, type BasicSelectProps } from "./basic";

interface SecretOrientedSelectProps extends Omit<BasicSelectProps, "options"> {
  categoryId: string;
}

export const SecretOrientedSelect = observer(function SecretOrientedSelect({
  categoryId,
  emptyMessage = "В категории нет доступных секретов",
  ...selectProps
}: SecretOrientedSelectProps) {
  const options = secretStorageStore.secrets
    .filter((secret) => secret.categoryId === categoryId)
    .map((secret) => ({ value: String(secret.id), label: secret.label }));

  return (
    <BasicSelect
      {...selectProps}
      options={options}
      emptyMessage={emptyMessage}
      searchable
      classNames={{ search: "mb-3" }}
    />
  );
});
