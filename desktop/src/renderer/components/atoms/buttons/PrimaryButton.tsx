import { Button } from "@kiyotakkkka/zvs-uikit-lib";
import { PlusIcon, SaveIcon } from "../icons";

const ICONS = {
  create: PlusIcon,
  save: SaveIcon,
};

const VARIANTS = {
  create: {
    loadingText: "Создание...",
  },
  save: {
    loadingText: "Сохранение...",
  },
};

const IconResolver = (icon: keyof typeof ICONS) => {
  const IconComponent = ICONS[icon];
  return <IconComponent className="size-4" />;
};

export const PrimaryButton = ({
  disabled = false,
  icon = true,
  type = "button",
  label = "Добавить",
  loading = false,
  variant = "create",
  form,
  onClick,
}: {
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: "create" | "save";
  icon?: boolean;
  label?: string;
  loading?: boolean;
  form?: string;
  onClick?: () => void;
}) => (
  <Button
    variant="primary"
    rounded="rounded-full"
    className="px-2!"
    onClick={onClick}
    disabled={disabled}
    type={type}
    form={form}
    loading={loading}
    classNames={{ loaderIcon: "border-t-main-900" }}
    loadingText={`${VARIANTS[variant].loadingText}`}
  >
    {icon && IconResolver(variant)}
    {label}
  </Button>
);
