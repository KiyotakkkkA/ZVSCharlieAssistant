import type { HTMLAttributes, ReactNode } from "react";

export type BasicAlertVariant = "info" | "success" | "warning" | "danger";

export interface BasicAlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  variant?: BasicAlertVariant;
  rounded?: string;
  classNames?: {
    icon?: string;
    content?: string;
    body?: string;
    title?: string;
  };
}

const VARIANT_STYLES: Record<
  BasicAlertVariant,
  { accent: string; icon: string; title: string }
> = {
  info: {
    accent: "bg-info-medium",
    icon: "bg-info-medium/10 text-info-light",
    title: "text-info-light",
  },
  success: {
    accent: "bg-success-medium",
    icon: "bg-success-medium/10 text-success-light",
    title: "text-success-light",
  },
  warning: {
    accent: "bg-warning-medium",
    icon: "bg-warning-medium/10 text-warning-light",
    title: "text-warning-light",
  },
  danger: {
    accent: "bg-danger-medium",
    icon: "bg-danger-medium/10 text-danger-light",
    title: "text-danger-light",
  },
};

export function BasicAlert({
  title,
  variant = "info",
  rounded = "rounded-xl",
  className,
  classNames,
  children,
  role,
  ...props
}: BasicAlertProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      role={
        role ?? (variant === "danger" || variant === "warning" ? "alert" : "status")
      }
      className={`relative overflow-hidden border border-main-700/60 bg-main-900/45 px-4 py-3 shadow-sm ${rounded} ${className ?? ""}`}
      {...props}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-0.5 ${styles.accent}`}
      />
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg ${styles.icon} ${classNames?.icon ?? ""}`}
        >
          <AlertIcon variant={variant} />
        </span>
        <div className={`min-w-0 flex-1 ${classNames?.content ?? ""}`}>
          {title ? (
            <div
              className={`text-sm font-medium leading-5 ${styles.title} ${classNames?.title ?? ""}`}
            >
              {title}
            </div>
          ) : null}
          {children ? (
            <div
              className={`${title ? "mt-0.5" : ""} text-xs leading-5 text-main-400 ${classNames?.body ?? ""}`}
            >
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AlertIcon({ variant }: { variant: BasicAlertVariant }) {
  if (variant === "success") {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M9.55 17.6 4.8 12.85l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
      </svg>
    );
  }

  if (variant === "warning") {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M12 3 1.8 20.5h20.4L12 3Zm1 14.5h-2v-2h2v2Zm0-4h-2v-5h2v5Z" />
      </svg>
    );
  }

  if (variant === "danger") {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.3 12.9-1.4 1.4-2.9-2.9-2.9 2.9-1.4-1.4 2.9-2.9-2.9-2.9 1.4-1.4 2.9 2.9 2.9-2.9 1.4 1.4-2.9 2.9 2.9 2.9Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
      <path d="M11 10h2v7h-2v-7Zm0-3h2v2h-2V7Zm1-5a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
    </svg>
  );
}
