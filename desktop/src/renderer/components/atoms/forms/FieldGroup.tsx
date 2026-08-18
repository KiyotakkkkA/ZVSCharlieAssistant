import type { ReactNode } from "react";

interface FieldGroupProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FieldGroup({
  label,
  children,
  className = "",
}: FieldGroupProps) {
  return (
    <div className={`block ${className}`}>
      <div className="mb-2 text-xs font-medium text-main-400">{label}</div>
      {children}
    </div>
  );
}
