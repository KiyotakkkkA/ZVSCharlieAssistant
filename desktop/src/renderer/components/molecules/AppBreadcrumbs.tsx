import { Breadcrumbs } from "@kiyotakkkka/zvs-uikit-lib";
import type { To } from "react-router-dom";
import { useHashRouter } from "../../hooks";

export interface AppBreadcrumbItem {
  label: React.ReactNode;
  to?: To;
}

interface AppBreadcrumbsProps {
  items: AppBreadcrumbItem[];
  className?: string;
}

export function AppBreadcrumbs({ items, className = "" }: AppBreadcrumbsProps) {
  const { goTo } = useHashRouter();

  return (
    <Breadcrumbs className={`ml-auto w-fit ${className}`}>
      {items.map((item, index) => {
        const active = index === items.length - 1;
        return (
          <Breadcrumbs.Nav
            key={index}
            label={item.label}
            active={active}
            disabled={!item.to && !active}
            onClick={item.to && !active ? () => goTo(item.to!) : undefined}
          />
        );
      })}
    </Breadcrumbs>
  );
}
