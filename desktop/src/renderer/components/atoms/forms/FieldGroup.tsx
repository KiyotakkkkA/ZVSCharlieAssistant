import type { ReactNode } from "react";

interface FieldGroupProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Labelled container for composite fields — lists, condition editors, groups
 * of controls.
 *
 * Deliberately a `<div>`, not a `<label>`: a label forwards every click inside
 * it to the first labelable control it contains, so wrapping a list of rows in
 * one would make a click anywhere in the list (including the delete button of
 * row 2) also trigger the delete button of row 1. Nesting labels — which
 * checkboxes render — is invalid markup for the same reason.
 */
export function FieldGroup({ label, children, className = "" }: FieldGroupProps) {
  return (
    <div className={`block ${className}`}>
      <div className="mb-2 text-xs font-medium text-main-400">{label}</div>
      {children}
    </div>
  );
}
