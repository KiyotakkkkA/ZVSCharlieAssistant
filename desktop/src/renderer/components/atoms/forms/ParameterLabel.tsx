import type { ReactNode } from "react";
import { Floating } from "@kiyotakkkka/zvs-uikit-lib";

export interface ParameterLabelProps {
  children: ReactNode;
  description: string;
}

export function ParameterLabel({
  children,
  description,
}: ParameterLabelProps) {
  return (
    <Floating anchor="top-left">
      <Floating.Trigger>
        <span className="cursor-help border-b border-dashed border-main-500/70">
          {children}
        </span>
      </Floating.Trigger>
      <Floating.Content className="w-72 text-xs font-normal leading-5 text-main-300">
        {description}
      </Floating.Content>
    </Floating>
  );
}
