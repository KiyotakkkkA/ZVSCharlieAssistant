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

export const CardStatusBadge = ({
  status,
}: {
  status: keyof typeof STATUSES;
}) => {
  return (
    <div
      className={`absolute bottom-0 right-0 flex gap-2 items-center px-3 py-1.5 text-xs text-main-50
          ${STATUSES[status].styling} rounded-br-xl rounded-tl-xl`}
    >
      {STATUSES[status].icon}
      <span>{STATUSES[status].label || "Нет данных"}</span>
    </div>
  );
};
