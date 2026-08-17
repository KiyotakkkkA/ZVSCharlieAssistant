import { randomUUID } from "node:crypto";
import {
  scenarioGraphSchema,
  type ScenarioEdge,
  type ScenarioGraph,
  type ScenarioNode,
} from "../../../../shared/scenario/graph";
import type {
  AutomationScenarioEdge,
  AutomationScenarioGraph,
  AutomationScenarioNode,
  JsonValue,
  ScenarioTriggerConfig,
} from "../../../../shared/dto";

const toJson = (value: unknown): Record<string, JsonValue> =>
  JSON.parse(JSON.stringify(value ?? {})) as Record<string, JsonValue>;

const TRIGGER_ID = (baseId: string, suffix: string) => `${baseId}__${suffix}`;

function findNode(
  graph: AutomationScenarioGraph,
  kind: AutomationScenarioNode["kind"],
): AutomationScenarioNode | undefined {
  return graph.nodes.find((node) => node.kind === kind);
}

function toV2Trigger(
  legacyTriggerId: string,
  x: number,
  y: number,
  index: number,
  kind: string,
  name: string,
  config: Record<string, unknown>,
): ScenarioNode {
  return {
    id: TRIGGER_ID(legacyTriggerId, `${kind}-${index}`),
    kind,
    name,
    description: "",
    x,
    y: y + index * 140,
    config,
    runtime: {},
    disabled: false,
    notes: "",
    groupId: null,
  };
}

function expandLegacyTrigger(
  legacyTrigger: AutomationScenarioNode,
  orchestratorId: string | undefined,
): { nodes: ScenarioNode[]; edges: ScenarioEdge[] } {
  const nodes: ScenarioNode[] = [];
  const edges: ScenarioEdge[] = [];
  const raw = (legacyTrigger.config?.trigger ?? {
    manual: { chatEnabled: true, editorEnabled: true },
    automatic: [],
  }) as ScenarioTriggerConfig;
  let index = 0;

  const wireToOrchestrator = (nodeId: string) => {
    if (!orchestratorId) return;
    edges.push({
      id: randomUUID(),
      source: nodeId,
      sourcePort: "main",
      target: orchestratorId,
      targetPort: "main",
    });
  };

  if (raw.manual?.chatEnabled || raw.manual?.editorEnabled) {
    const node = toV2Trigger(
      legacyTrigger.id,
      legacyTrigger.x,
      legacyTrigger.y,
      index++,
      "trigger.manual",
      "Ручной запуск",
      {
        fromChat: Boolean(raw.manual?.chatEnabled),
        fromEditor: Boolean(raw.manual?.editorEnabled),
        inputFields: [],
      },
    );
    nodes.push(node);
    wireToOrchestrator(node.id);
  }

  for (const auto of raw.automatic ?? []) {
    if (auto.kind === "telegram") {
      const node = toV2Trigger(
        legacyTrigger.id,
        legacyTrigger.x,
        legacyTrigger.y,
        index++,
        "trigger.telegram",
        "Telegram",
        {
          integrationProfileId: auto.integrationProfileId,
          allowedChatIds: auto.allowedChatIds ?? [],
          allowAnyChat: (auto.allowedChatIds ?? []).length === 0,
          command: auto.command ?? "",
          includeAttachments: Boolean(auto.includeAttachments),
          ignoreBots: true,
        },
      );
      nodes.push(node);
      if (auto.enabled !== false) wireToOrchestrator(node.id);
    } else if (auto.kind === "email") {
      const node = toV2Trigger(
        legacyTrigger.id,
        legacyTrigger.x,
        legacyTrigger.y,
        index++,
        "trigger.email",
        "Email",
        {
          integrationProfileId: auto.integrationProfileId,
          mailbox: auto.mailbox ?? "",
          from: auto.from ?? "",
          subjectContains: auto.subjectContains ?? "",
          unreadOnly: Boolean(auto.unreadOnly),
          includeAttachments: Boolean(auto.includeAttachments),
          markAsRead: false,
        },
      );
      nodes.push(node);
      if (auto.enabled !== false) wireToOrchestrator(node.id);
    } else if (auto.kind === "interval") {
      const node = toV2Trigger(
        legacyTrigger.id,
        legacyTrigger.x,
        legacyTrigger.y,
        index++,
        "trigger.interval",
        "По расписанию",
        {
          intervalSeconds: auto.intervalSeconds,
          timezone: auto.timezone ?? "UTC",
          misfirePolicy: auto.misfirePolicy ?? "skip",
          catchUpLimit: 5,
          preventOverlap: Boolean(auto.preventOverlap),
        },
      );
      nodes.push(node);
      if (auto.enabled !== false) wireToOrchestrator(node.id);
    }
  }

  if (nodes.length === 0) {
    const node = toV2Trigger(
      legacyTrigger.id,
      legacyTrigger.x,
      legacyTrigger.y,
      0,
      "trigger.manual",
      "Ручной запуск",
      { fromChat: false, fromEditor: false, inputFields: [] },
    );
    node.disabled = true;
    nodes.push(node);
  }

  return { nodes, edges };
}

function mapNode(node: AutomationScenarioNode): ScenarioNode | null {
  const base = {
    id: node.id,
    name: node.title,
    description: "",
    x: node.x,
    y: node.y,
    runtime: {},
    disabled: false,
    notes: "",
    groupId: null,
  };
  const config = (node.config ?? {}) as Record<string, unknown>;

  switch (node.kind) {
    case "trigger":
      return null;
    case "orchestrator":
      return {
        ...base,
        kind: "orchestrator",
        config: {
          modelId: config.modelId ?? null,
          mode: "llm",
          objective: "",
          synthesize: true,
          synthesisInstructions: "",
          strictPlan: false,
          maxOutputTokens: 2_400,
        },
      };
    case "agent":
      return {
        ...base,
        kind: "agent",
        config: {
          agentId: config.agentId ?? "",
          scenarioInstructions: config.scenarioInstructions ?? "",
          input: "items",
          inputExpression: "",
          outputMode: "text",
          jsonSchema: "",
          modelId: null,
          maxToolCalls: null,
          temperature: null,
          targetField: "text",
        },
      };
    case "knowledge_store":
      return {
        ...base,
        kind: "knowledgeStore",
        config: {
          vectorStoreId: config.vectorStoreId ?? 0,
          limit: 8,
          minScore: 0,
        },
      };
    case "download_files":
      return {
        ...base,
        kind: "downloadFiles",
        config: {
          source: "binary",
          urls: "",
          maxFileSizeMb: config.maxFileSizeMb ?? 50,
          maxFiles: 20,
          cleanupOnFinish: config.cleanupOnFinish ?? true,
        },
      };
    case "read_files":
      return {
        ...base,
        kind: "readFiles",
        config: {
          maxCharactersPerFile: config.maxCharactersPerFile ?? 100_000,
          output: "inline",
          targetField: "text",
          itemPerFile: true,
        },
      };
    case "condition":
      return {
        ...base,
        kind: "if",
        config: {
          combinator: "and",
          conditions:
            config.equals !== undefined
              ? [
                  {
                    left: "{{ $json.value }}",
                    operator: "equals",
                    right: String(config.equals),
                    caseSensitive: false,
                  },
                ]
              : [
                  {
                    left: "",
                    operator: "isNotEmpty",
                    right: "",
                    caseSensitive: false,
                  },
                ],
        },
      };
    case "approval": {
      const approvalConfig = config as {
        mode?: "confirm" | "choice" | "text";
        header?: string;
        prompt?: string;
        options?: Array<{ label?: string; description?: string }>;
        multiSelect?: boolean;
        defaultAnswer?: string | null;
        timeoutSeconds?: number | null;
      };
      return {
        ...base,
        kind: "approval",
        config: {
          mode: approvalConfig.mode ?? "confirm",
          header: approvalConfig.header ?? "Требуется решение",
          prompt: approvalConfig.prompt ?? "Продолжить выполнение сценария?",
          options: (approvalConfig.options ?? []).map((option) => ({
            label: option.label ?? "",
            description: option.description ?? "",
          })),
          multiSelect: Boolean(approvalConfig.multiSelect),
          defaultAnswer: approvalConfig.defaultAnswer ?? null,
          timeoutSeconds: approvalConfig.timeoutSeconds ?? null,
          channel: "ui",
          integrationProfileId: null,
          recipient: "",
        },
      };
    }
    case "output": {
      const response = (config.response ?? { channels: [] }) as {
        channels?: Array<{
          channel: "telegram" | "email";
          enabled?: boolean;
          mode?: "reply_to_trigger" | "explicit_recipient";
          integrationProfileId?: number | null;
          recipient?: string;
        }>;
      };
      return {
        ...base,
        kind: "output",
        config: {
          text: "{{ $json.text }}",
          channels: (response.channels ?? []).map((channel) => ({
            channel: channel.channel,
            enabled: channel.enabled ?? true,
            mode: channel.mode ?? "reply_to_trigger",
            integrationProfileId: channel.integrationProfileId ?? null,
            recipient: channel.recipient ?? "",
            subject: "",
            attachFiles: false,
          })),
          saveArtifact: false,
          artifactFileName: "",
        },
      };
    }
    default:
      return null;
  }
}

function mapEdge(
  edge: AutomationScenarioEdge,
  triggerExpansions: Map<string, ScenarioNode[]>,
  orchestratorId: string | undefined,
): ScenarioEdge[] {
  const sourceExpansion = triggerExpansions.get(edge.source);
  const sources = sourceExpansion?.map((n) => n.id) ?? [edge.source];

  const sourcePort =
    edge.kind === "worker"
      ? "workers"
      : edge.kind === "knowledge"
        ? "knowledge"
        : "main";
  const targetPort =
    edge.kind === "worker"
      ? "main"
      : edge.kind === "knowledge"
        ? "knowledge"
        : "main";

  return sources.map((source) => ({
    id: sources.length > 1 ? randomUUID() : edge.id,
    source,
    sourcePort,
    target: edge.target,
    targetPort,
  }));
}

export function legacyGraphToScenarioGraph(
  legacy: AutomationScenarioGraph,
): ScenarioGraph {
  const orchestrator = findNode(legacy, "orchestrator");
  const legacyTrigger = findNode(legacy, "trigger");

  const nodes: ScenarioNode[] = [];
  const edges: ScenarioEdge[] = [];
  const triggerExpansions = new Map<string, ScenarioNode[]>();

  if (legacyTrigger) {
    const expanded = expandLegacyTrigger(legacyTrigger, orchestrator?.id);
    nodes.push(...expanded.nodes);
    edges.push(...expanded.edges);
    triggerExpansions.set(legacyTrigger.id, expanded.nodes);
  }

  for (const legacyNode of legacy.nodes) {
    const mapped = mapNode(legacyNode);
    if (mapped) nodes.push(mapped);
  }

  for (const legacyEdge of legacy.edges) {
    edges.push(...mapEdge(legacyEdge, triggerExpansions, orchestrator?.id));
  }

  return scenarioGraphSchema.parse({
    version: 2,
    nodes,
    edges,
    groups: [],
    variables: [],
    maxNodeExecutions: 1_000,
    viewport: legacy.viewport,
  });
}

const LEGACY_TRIGGER_ID = "trigger";

function unmapNode(node: ScenarioNode): AutomationScenarioNode | null {
  const base = {
    id: node.id,
    title: node.name,
    x: node.x,
    y: node.y,
  };
  switch (node.kind) {
    case "orchestrator":
      return {
        ...base,
        kind: "orchestrator",
        description: "",
        config: toJson({
          modelId: (node.config as { modelId?: unknown }).modelId ?? null,
        }),
      };
    case "agent": {
      const config = node.config as {
        agentId?: string;
        scenarioInstructions?: string;
      };
      return {
        ...base,
        kind: "agent",
        description: "",
        config: toJson({
          agentId: config.agentId ?? "",
          scenarioInstructions: config.scenarioInstructions ?? "",
        }),
      };
    }
    case "knowledgeStore":
      return {
        ...base,
        kind: "knowledge_store",
        description: "",
        config: toJson({
          vectorStoreId:
            (node.config as { vectorStoreId?: unknown }).vectorStoreId ?? 0,
        }),
      };
    case "downloadFiles": {
      const config = node.config as {
        maxFileSizeMb?: unknown;
        cleanupOnFinish?: unknown;
      };
      return {
        ...base,
        kind: "download_files",
        description: "",
        config: toJson({
          maxFileSizeMb: config.maxFileSizeMb ?? 50,
          cleanupOnFinish: config.cleanupOnFinish ?? true,
        }),
      };
    }
    case "readFiles": {
      const config = node.config as { maxCharactersPerFile?: unknown };
      return {
        ...base,
        kind: "read_files",
        description: "",
        config: toJson({
          maxCharactersPerFile: config.maxCharactersPerFile ?? 100_000,
        }),
      };
    }
    case "if": {
      const config = node.config as {
        conditions?: Array<{ right?: unknown }>;
      };
      const first = config.conditions?.[0];
      return {
        ...base,
        kind: "condition",
        description: "",
        config: toJson(
          first?.right !== undefined ? { equals: first.right } : {},
        ),
      };
    }
    case "approval": {
      const config = node.config as Record<string, unknown>;
      return {
        ...base,
        kind: "approval",
        description: "",
        config: toJson({
          mode: config.mode,
          header: config.header,
          prompt: config.prompt,
          options: config.options,
          multiSelect: config.multiSelect,
          defaultAnswer: config.defaultAnswer,
          timeoutSeconds: config.timeoutSeconds,
        }),
      };
    }
    case "output": {
      const config = node.config as {
        channels?: Array<{
          channel: "telegram" | "email";
          enabled?: boolean;
          mode?: string;
          integrationProfileId?: number | null;
          recipient?: string;
        }>;
      };
      return {
        ...base,
        kind: "output",
        description: "",
        config: toJson({
          response: {
            channels: (config.channels ?? []).map((channel) => ({
              channel: channel.channel,
              enabled: channel.enabled ?? true,
              mode: channel.mode ?? "reply_to_trigger",
              integrationProfileId: channel.integrationProfileId ?? null,
              recipient: channel.recipient ?? "",
            })),
          },
        }),
      };
    }
    default:
      return null;
  }
}

export function scenarioGraphToLegacyGraph(
  graph: ScenarioGraph,
): AutomationScenarioGraph {
  const triggerNodes = graph.nodes.filter((n) => n.kind.startsWith("trigger."));
  const orchestrator = graph.nodes.find((n) => n.kind === "orchestrator");

  const nodes: AutomationScenarioNode[] = [];
  for (const node of graph.nodes) {
    const mapped = unmapNode(node);
    if (mapped) nodes.push(mapped);
  }

  const manual = triggerNodes.find((n) => n.kind === "trigger.manual");
  const automatic = triggerNodes
    .filter((n) => n.kind !== "trigger.manual")
    .map((n) => {
      const config = n.config as Record<string, unknown>;
      if (n.kind === "trigger.telegram")
        return {
          id: n.id,
          kind: "telegram" as const,
          enabled: !n.disabled,
          integrationProfileId: Number(config.integrationProfileId ?? 0),
          allowedChatIds: (config.allowedChatIds as string[]) ?? [],
          command: String(config.command ?? ""),
          includeAttachments: Boolean(config.includeAttachments),
        };
      if (n.kind === "trigger.email")
        return {
          id: n.id,
          kind: "email" as const,
          enabled: !n.disabled,
          integrationProfileId: Number(config.integrationProfileId ?? 0),
          mailbox: String(config.mailbox ?? ""),
          from: String(config.from ?? ""),
          subjectContains: String(config.subjectContains ?? ""),
          unreadOnly: Boolean(config.unreadOnly),
          includeAttachments: Boolean(config.includeAttachments),
        };
      return {
        id: n.id,
        kind: "interval" as const,
        enabled: !n.disabled,
        intervalSeconds: Number(config.intervalSeconds ?? 3_600),
        timezone: String(config.timezone ?? "UTC"),
        misfirePolicy:
          (config.misfirePolicy as "skip" | "run_once" | "catch_up") ?? "skip",
        preventOverlap: Boolean(config.preventOverlap),
      };
    });

  const manualConfig = manual?.config as
    | { fromChat?: boolean; fromEditor?: boolean }
    | undefined;

  nodes.unshift({
    id: LEGACY_TRIGGER_ID,
    kind: "trigger",
    title: "Триггер",
    description: "",
    x: manual?.x ?? triggerNodes[0]?.x ?? 70,
    y: manual?.y ?? triggerNodes[0]?.y ?? 70,
    config: toJson({
      trigger: {
        manual: {
          chatEnabled: manual ? Boolean(manualConfig?.fromChat) : true,
          editorEnabled: manual ? Boolean(manualConfig?.fromEditor) : true,
        },
        automatic,
      } satisfies ScenarioTriggerConfig,
    }),
  });

  const triggerIds = new Set(triggerNodes.map((n) => n.id));
  const edges: AutomationScenarioEdge[] = [];
  for (const edge of graph.edges) {
    if (triggerIds.has(edge.source) && edge.target === orchestrator?.id)
      continue;
    if (triggerIds.has(edge.source)) {
      edges.push({
        id: edge.id,
        kind:
          edge.sourcePort === "workers"
            ? "worker"
            : edge.sourcePort === "knowledge"
              ? "knowledge"
              : "files",
        source: LEGACY_TRIGGER_ID,
        target: edge.target,
        sourcePort: edge.sourcePort,
        targetPort: edge.targetPort,
      });
      continue;
    }
    edges.push({
      id: edge.id,
      kind:
        edge.sourcePort === "workers"
          ? "worker"
          : edge.sourcePort === "knowledge"
            ? "knowledge"
            : "text",
      source: edge.source,
      target: edge.target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
    });
  }

  return { nodes, edges, viewport: graph.viewport };
}
