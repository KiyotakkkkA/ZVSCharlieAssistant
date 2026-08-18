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

/** Maps the descriptor's abstract icon name to a concrete icon component. */
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

/** Tailwind classes per node category — one visual language across the canvas. */
export const CATEGORY_STYLES: Record<
  NodeCategory,
  { icon: string; dot: string; chip: string }
> = {
  trigger: {
    icon: "bg-amber-400/10 text-amber-200",
    dot: "bg-amber-300",
    chip: "text-amber-200/90",
  },
  ai: {
    icon: "bg-violet-400/10 text-violet-200",
    dot: "bg-violet-300",
    chip: "text-violet-200/90",
  },
  data: {
    icon: "bg-cyan-400/10 text-cyan-200",
    dot: "bg-cyan-300",
    chip: "text-cyan-200/90",
  },
  flow: {
    icon: "bg-sky-400/10 text-sky-200",
    dot: "bg-sky-300",
    chip: "text-sky-200/90",
  },
  io: {
    icon: "bg-blue-400/10 text-blue-200",
    dot: "bg-blue-300",
    chip: "text-blue-200/90",
  },
  output: {
    icon: "bg-emerald-400/10 text-emerald-200",
    dot: "bg-emerald-300",
    chip: "text-emerald-200/90",
  },
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

/**
 * Resolves how a node kind should look. Everything comes from the descriptor
 * registry, so registering a node in the engine is enough for it to render.
 */
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
