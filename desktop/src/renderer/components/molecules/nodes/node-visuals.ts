import {
  BlockIcon,
  BrainIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  FactoryIcon,
  FileIcon,
  GraphIcon,
  MailIcon,
  NumbersIcon,
  PlayCircleIcon,
  QuestionIcon,
  RefreshIcon,
  RobotIcon,
  ScriptIcon,
  SearchIcon,
  SendIcon,
  StorageIcon,
  TelegramIcon,
  TransitConnectionIcon,
  WebIcon,
  type SvgIcon,
} from "@renderer/components/atoms";
import { scenarioDescriptors } from "../../../../shared/scenario/descriptors";
import type { NodeCategory } from "../../../../shared/scenario/node-descriptor";

const ICONS: Record<string, SvgIcon> = {
  play: PlayCircleIcon,
  clock: ClockIcon,
  telegram: TelegramIcon,
  mail: MailIcon,
  agent: RobotIcon,
  orchestrator: FactoryIcon,
  classify: BrainIcon,
  fields: NumbersIcon,
  aggregate: GraphIcon,
  split: TransitConnectionIcon,
  sort: NumbersIcon,
  dedupe: CopyIcon,
  http: WebIcon,
  download: DownloadIcon,
  read: FileIcon,
  knowledge: StorageIcon,
  branch: TransitConnectionIcon,
  switch: TransitConnectionIcon,
  filter: SearchIcon,
  merge: TransitConnectionIcon,
  loop: RefreshIcon,
  limit: BlockIcon,
  question: QuestionIcon,
  subflow: ScriptIcon,
  output: SendIcon,
  dot: CheckIcon,
};

export const CATEGORY_STYLES: Record<
  NodeCategory,
  { icon: string; dot: string; chip: string }
> = {
  trigger: {
    icon: "bg-[var(--node-soft-trigger)] text-[var(--node-accent-trigger)]",
    dot: "bg-[var(--node-accent-trigger)]",
    chip: "text-[var(--node-accent-trigger)]",
  },
  ai: {
    icon: "bg-[var(--node-soft-ai)] text-[var(--node-accent-ai)]",
    dot: "bg-[var(--node-accent-ai)]",
    chip: "text-[var(--node-accent-ai)]",
  },
  data: {
    icon: "bg-[var(--node-soft-data)] text-[var(--node-accent-data)]",
    dot: "bg-[var(--node-accent-data)]",
    chip: "text-[var(--node-accent-data)]",
  },
  flow: {
    icon: "bg-[var(--node-soft-flow)] text-[var(--node-accent-flow)]",
    dot: "bg-[var(--node-accent-flow)]",
    chip: "text-[var(--node-accent-flow)]",
  },
  io: {
    icon: "bg-[var(--node-soft-io)] text-[var(--node-accent-io)]",
    dot: "bg-[var(--node-accent-io)]",
    chip: "text-[var(--node-accent-io)]",
  },
  output: {
    icon: "bg-[var(--node-soft-output)] text-[var(--node-accent-output)]",
    dot: "bg-[var(--node-accent-output)]",
    chip: "text-[var(--node-accent-output)]",
  },
};

export const CATEGORY_ACCENT_VARS: Record<NodeCategory, string> = {
  trigger: "--node-accent-trigger",
  ai: "--node-accent-ai",
  data: "--node-accent-data",
  flow: "--node-accent-flow",
  io: "--node-accent-io",
  output: "--node-accent-output",
};

export interface ScenarioNodeVisual {
  label: string;
  description: string;
  category: NodeCategory;
  icon: SvgIcon;
  iconClassName: string;
  dotClassName: string;
}

const FALLBACK: ScenarioNodeVisual = {
  label: "Узел",
  description: "",
  category: "data",
  icon: CheckIcon,
  iconClassName: CATEGORY_STYLES.data.icon,
  dotClassName: CATEGORY_STYLES.data.dot,
};

export function nodeVisual(kind: string): ScenarioNodeVisual {
  const descriptor = scenarioDescriptors.get(kind);
  if (!descriptor) return FALLBACK;
  const style = CATEGORY_STYLES[descriptor.category] ?? CATEGORY_STYLES.data;
  return {
    label: descriptor.label,
    description: descriptor.description,
    category: descriptor.category,
    icon: ICONS[descriptor.icon ?? ""] ?? CheckIcon,
    iconClassName: style.icon,
    dotClassName: style.dot,
  };
}
