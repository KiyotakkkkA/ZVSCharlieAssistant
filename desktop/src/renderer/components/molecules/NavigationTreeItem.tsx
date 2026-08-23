import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import type { NavigationRoute } from "../../app/routes";
import { ChevronDownIcon } from "../atoms";

interface NavigationTreeItemProps {
  currentPath: string;
  depth?: number;
  node: NavigationRoute;
}

function routeMatches(path: string, routePath: string): boolean {
  return routePath === "/"
    ? path === routePath
    : path === routePath || path.startsWith(`${routePath}/`);
}

function containsActiveRoute(
  node: NavigationRoute,
  currentPath: string,
): boolean {
  if (node.path && routeMatches(currentPath, node.path)) return true;
  return (
    node.children?.some((child) => containsActiveRoute(child, currentPath)) ??
    false
  );
}

export function NavigationTreeItem({
  currentPath,
  depth = 0,
  node,
}: NavigationTreeItemProps) {
  const hasChildren = Boolean(node.children?.length);
  const containsActive = containsActiveRoute(node, currentPath);
  const [expanded, setExpanded] = useState(containsActive);
  const NodeIcon = node.icon;

  useEffect(() => {
    if (containsActive) setExpanded(true);
  }, [containsActive]);

  const itemClassName = [
    "group relative flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-2",
    "text-left text-main-300 outline-none",
    "transition-[color,background-color,box-shadow] duration-150 ease-out",
    "hover:bg-main-800/80 hover:text-main-50 cursor-pointer",
  ].join(" ");

  return (
    <div>
      {hasChildren ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={[
            itemClassName,
            containsActive ? "bg-main-700/45 text-main-50" : "",
          ].join(" ")}
        >
          <NodeIcon
            className={[
              "size-5 shrink-0 transition-colors duration-150",
              containsActive ? "text-main-100" : "text-main-400",
            ].join(" ")}
          />
          <span className="min-w-0 flex-1 truncate font-medium">
            {node.label}
          </span>
          <ChevronDownIcon
            className={[
              "size-3.5 shrink-0 text-main-500 transition-[transform,color] duration-200",
              "group-hover:text-main-300",
              expanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      ) : node.path ? (
        <NavLink
          data-tour={`nav-${node.id.replace(/^(automation|storage|settings)-/, "")}`}
          to={node.path}
          end
          className={({ isActive }) =>
            [
              itemClassName,
              isActive
                ? [
                    "bg-main-700/60 text-main-50",
                    depth > 0
                      ? "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-main-100"
                      : "",
                  ].join(" ")
                : "",
            ].join(" ")
          }
        >
          <NodeIcon className="size-5 shrink-0 text-main-400 transition-colors duration-150 group-hover:text-main-200" />
          <span className="min-w-0 truncate font-medium">{node.label}</span>
        </NavLink>
      ) : null}

      {hasChildren ? (
        <div
          className={[
            "ml-3 grid border-l border-main-700/80 pl-2",
            "transition-[grid-template-rows,opacity] duration-200 ease-out",
            expanded
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0",
          ].join(" ")}
        >
          <div className="overflow-hidden">
            <div className="mt-1 space-y-0.5">
              {node.children?.map((child) => (
                <NavigationTreeItem
                  key={child.id}
                  node={child}
                  currentPath={currentPath}
                  depth={depth + 1}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
