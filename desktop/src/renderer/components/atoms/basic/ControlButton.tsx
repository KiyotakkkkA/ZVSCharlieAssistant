import { Button } from "@kiyotakkkka/zvs-uikit-lib";
import { CopyIcon, EditIcon, EyeIcon, TrashIcon } from "../icons";

const ICONS = {
  copy: CopyIcon,
  edit: EditIcon,
  trash: TrashIcon,
  eye: EyeIcon,
};

const IconResolver = (icon: keyof typeof ICONS) => {
  const IconComponent = ICONS[icon];
  return <IconComponent className="size-4" />;
};

const VARIANTS = {
  manage: "text-main-400 hover:text-main-50 hover:bg-main-600/20",
  delete: "text-red-400 hover:bg-red-400/10",
};

export const ControlButton = ({
  className,
  disabled = false,
  icon = "edit",
  title,
  variant = "manage",
  onClick,
}: {
  className?: string;
  disabled?: boolean;
  icon?: keyof typeof ICONS;
  title?: string;
  variant?: "manage" | "delete";
  onClick?: () => void;
}) => (
  <Button
    variant="ghost"
    rounded="rounded-lg"
    className={`size-9 p-0 ${VARIANTS[variant]} ${className || ""}`}
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
    disabled={disabled}
    title={title}
  >
    {icon && IconResolver(icon)}
  </Button>
);
