import type { ReactNode } from "react";

export interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, children, className = "" }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-2 text-xs font-medium text-main-400">
        {label}
      </div>
      {children}
    </label>
  );
}
