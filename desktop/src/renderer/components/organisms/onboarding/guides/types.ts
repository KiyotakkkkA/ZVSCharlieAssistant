import type { AppPath } from "../../../../app/routes";
import type { SvgIcon } from "../../../atoms";

export interface GuideStep {
  id: string;
  target: string;
  title: string;
  description: string;
  points?: readonly string[];
  route: AppPath;
  placement?: "top" | "bottom" | "left" | "right";
  optional?: boolean;
}

export interface Guide {
  id: string;
  order: number;
  title: string;
  description: string;
  result: string;
  duration: string;
  icon: SvgIcon;
  recommendedBefore?: readonly string[];
  steps: readonly GuideStep[];
}
