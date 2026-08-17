import type { z } from "zod";
import type { ExpressionScope } from "../expressions";
import type { ScenarioBinaryRef, ScenarioItems } from "./items";
import type {
  NodeErrorMode,
  NodeRetryPolicy,
  ScenarioDataKind,
  ScenarioEdge,
  ScenarioGraph,
  ScenarioNode,
  ScenarioValidationIssue,
} from "./graph";

export interface PortSpec {
  id: string;
  label: string;
  dataKind: ScenarioDataKind;
  side: "top" | "right" | "bottom" | "left";
  multiple: boolean;
  optional?: boolean;
  description?: string;
}

export type NodeItemMode = "collection" | "each";

export interface NodeRuntimeDefaults {
  retry?: Partial<NodeRetryPolicy>;
  onError?: NodeErrorMode;
  timeoutSeconds?: number;
  concurrency?: number;
}

export type NodeCategory = "trigger" | "ai" | "data" | "flow" | "io" | "output";

export interface ScenarioNodeDescriptor<C = unknown> {
  kind: string;
  label: string;
  category: NodeCategory;
  description: string;
  documentation?: string;
  icon?: string;
  accent?: string;

  configSchema: z.ZodType<C>;
  defaultConfig?: () => Record<string, unknown>;

  inputs: PortSpec[] | ((config: Record<string, unknown>) => PortSpec[]);
  outputs: PortSpec[] | ((config: Record<string, unknown>) => PortSpec[]);

  defaults?: NodeRuntimeDefaults;
  itemMode: NodeItemMode;

  isTrigger?: boolean;
  isTerminal?: boolean;
  allowsLoopBack?: boolean;
  maxPerScenario?: number;
  idempotent?: boolean;

  validate?(input: {
    node: ScenarioNode;
    graph: ScenarioGraph;
    incoming: ScenarioEdge[];
    outgoing: ScenarioEdge[];
  }): ScenarioValidationIssue[];
}

export interface NodeLogger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, error?: unknown, fields?: Record<string, unknown>): void;
}

export interface NodeOutput {
  outputs?: Record<string, ScenarioItems>;
  items?: ScenarioItems;
  diagnostics?: Record<string, unknown>;
}

export interface NodeExecutionContext<C = unknown, S = unknown> {
  node: ScenarioNode;
  config: C;
  rawConfig: Record<string, unknown>;

  items: ScenarioItems;
  inputs: Readonly<Record<string, ScenarioItems>>;

  executionId: number;
  nodeRunId: number;
  attempt: number;
  iteration: number;
  scenarioId: string;
  scenarioRevisionId: number;
  graph: ScenarioGraph;

  signal: AbortSignal;
  logger: NodeLogger;
  services: S;

  scope(itemIndex?: number): ExpressionScope;
  stream(delta: string): void;
  trackBinary(ref: ScenarioBinaryRef): void;
  state<T>(initial: () => T): { get(): T; set(value: T): void };
}

export interface NodeExecutor<C = unknown, S = unknown> {
  kind: string;
  execute(context: NodeExecutionContext<C, S>): Promise<NodeOutput>;
}

export function resolvePorts(
  spec: PortSpec[] | ((config: Record<string, unknown>) => PortSpec[]),
  config: Record<string, unknown>,
): PortSpec[] {
  try {
    return typeof spec === "function" ? spec(config) : spec;
  } catch {
    return typeof spec === "function" ? [] : spec;
  }
}

export const mainInput = (overrides: Partial<PortSpec> = {}): PortSpec => ({
  id: "main",
  label: "Вход",
  dataKind: "main",
  side: "left",
  multiple: true,
  ...overrides,
});

export const mainOutput = (overrides: Partial<PortSpec> = {}): PortSpec => ({
  id: "main",
  label: "Выход",
  dataKind: "main",
  side: "right",
  multiple: true,
  ...overrides,
});

export const errorOutput = (): PortSpec => ({
  id: "error",
  label: "Ошибка",
  dataKind: "main",
  side: "bottom",
  multiple: true,
  optional: true,
  description:
    "Items, на которых узел упал. Работает, когда в поведении при ошибке выбран «отдельный выход».",
});

export const knowledgeInput = (): PortSpec => ({
  id: "knowledge",
  label: "База знаний",
  dataKind: "knowledge",
  side: "top",
  multiple: true,
  optional: true,
});

export const knowledgeOutput = (): PortSpec => ({
  id: "knowledge",
  label: "Контекст",
  dataKind: "knowledge",
  side: "right",
  multiple: true,
});
