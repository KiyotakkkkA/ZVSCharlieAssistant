import { Button } from "@kiyotakkkka/zvs-uikit-lib";
import { PlusIcon } from "../icons";

export const CreateButton = ({
  disabled = false,
  icon = true,
  type = "button",
  label = "Добавить",
  loading = false,
  onClick,
}: {
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  icon?: boolean;
  label?: string;
  loading?: boolean;
  onClick?: () => void;
}) => (
  <Button
    variant="primary"
    rounded="rounded-full"
    className="px-2"
    onClick={onClick}
    disabled={disabled}
    type={type}
    loading={loading}
    loadingText="Создание..."
  >
    {icon && <PlusIcon className="size-4" />}
    {label}
  </Button>
);
