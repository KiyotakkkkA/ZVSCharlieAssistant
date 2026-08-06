import { CheckIcon, BlockIcon, FileClockIcon } from "./icons";

const STATUSES = {
  active: {
    label: "Активен",
    icon: <CheckIcon className="size-4" />,
    styling: "bg-accent-dark/50",
  },
  disabled: {
    label: "Отключён",
    icon: <BlockIcon className="size-4" />,
    styling: "bg-danger-dark",
  },
  draft: {
    label: "Черновик",
    icon: <FileClockIcon className="size-4" />,
    styling: "bg-main-600",
  },
} as const;

const CLASSES = {
  card: "rounded-br-xl rounded-tl-xl absolute bottom-0 right-0",
  base: "w-fit rounded-full",
} as const;

export const EntityStatusBadge = ({
  variant = "card",
  status,
}: {
  variant?: "card" | "base";
  status: keyof typeof STATUSES;
}) => {
  return (
    <div
      className={`flex gap-2 items-center px-3 py-1.5 text-xs text-main-50
          ${STATUSES[status].styling} ${CLASSES[variant]}`}
    >
      {STATUSES[status].icon}
      <span>{STATUSES[status].label || "Нет данных"}</span>
    </div>
  );
};
