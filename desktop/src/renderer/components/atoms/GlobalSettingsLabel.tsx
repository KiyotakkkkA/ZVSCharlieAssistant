import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import { useGlobalSettings } from "./GlobalSettingsContext";

export interface GlobalSettingsLabelProps {
  id: string;
  parentId?: string;
  label: string;
  description?: string;
  keywords?: string[];
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  level?: "form" | "anchor";
  presentation?: "section" | "setting";
  className?: string;
}

export function GlobalSettingsLabel({
  id,
  parentId,
  label,
  description,
  keywords = [],
  icon,
  level = "anchor",
  presentation = "section",
  className = "",
}: GlobalSettingsLabelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { register } = useGlobalSettings();
  const keywordsKey = keywords.join("\u0000");

  useEffect(() => {
    if (!ref.current) return;
    return register({
      id,
      parentId,
      label,
      description: description ?? "",
      keywords: keywordsKey ? keywordsKey.split("\u0000") : [],
      icon,
      level,
      element: ref.current,
    });
  }, [id, parentId, label, description, keywordsKey, icon, level, register]);

  return (
    <div ref={ref} data-setting-id={id} className={className}>
      {level === "form" ? null : presentation === "setting" ? (
        <>
          <h4 className="text-sm font-medium text-main-100">{label}</h4>
          <p className="mt-1 text-xs leading-5 text-main-400">{description}</p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold tracking-tight text-main-50">
            {label}
          </h3>
          <p className="mt-1 text-xs leading-5 text-main-400">{description}</p>
        </>
      )}
    </div>
  );
}
