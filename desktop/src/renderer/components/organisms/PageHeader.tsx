import type { ReactNode } from "react";
import { AppBreadcrumbs, type AppBreadcrumbItem } from "../molecules";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs: AppBreadcrumbItem[];
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  children,
  footer,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`mb-5 border-b border-main-800 px-1 pb-4 ${className}`}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-8">
        <div className="min-w-0 self-end py-1">
          <h1 className="text-2xl font-semibold tracking-tight text-main-50">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-main-400">
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col items-end justify-between gap-4 md:min-w-64">
          <AppBreadcrumbs items={breadcrumbs} />
          {children ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {children}
            </div>
          ) : null}
        </div>
      </div>

      {footer ? (
        <div className="mt-4 flex min-h-9 items-center border-main-800/70 pt-4">
          {footer}
        </div>
      ) : null}
    </header>
  );
}
