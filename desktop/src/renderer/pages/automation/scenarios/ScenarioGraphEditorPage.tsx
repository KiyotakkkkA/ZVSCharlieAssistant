import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Connection, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import { applyEdgeChanges } from "@xyflow/react";
import {
  Button,
  InputCheckBox,
  InputSmall,
  ScrollArea,
  Select,
  Tooltip,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { useParams } from "react-router-dom";
import { observer } from "mobx-react-lite";
import {
  BlockIcon,
  ChevronLeftIcon,
  CogIcon,
  CreationIcon,
  EditIcon,
  PlusIcon,
  RobotIcon,
  SaveIcon,
  SendIcon,
} from "../../../components/atoms";
import {
  ResizableSidePanel,
  ScenarioGraphCanvas,
  type ScenarioFlowEdge,
  type ScenarioFlowNode,
} from "../../../components/organisms";
import { DynamicNodeConfigForm } from "../../../components/organisms/forms";
import { nodeVisual } from "../../../components/molecules/nodes";
import { nodeSummary } from "../../../components/molecules/nodes/node-summary";
import { ExpressionScopeProvider } from "../../../components/molecules";
import type { ExpressionScope } from "../../../components/molecules/expression/completions";
import {
  inferIncomingShape,
  inferNodeOutputShape,
} from "../../../components/molecules/expression/infer";
import { DangerModal } from "@renderer/components/organisms/modals";
import { AIEntityCreateForm } from "../../../components/organisms/forms";
import { APP_PATHS } from "../../../app/routes";
import { readCssColor, useAppNavigation, useThemeMode } from "../../../hooks";
import {
  automationStore,
  textProviderStore,
  vectorStoreStore,
} from "../../../stores";
import {
  emptyScenarioGraph,
  scenarioGraphSchema,
  type ScenarioEdge,
  type ScenarioGraph,
  type ScenarioNode,
  type ScenarioValidationIssue,
} from "../../../../shared/scenario/graph";
import {
  CATEGORY_LABELS,
  scenarioDescriptors,
} from "../../../../shared/scenario/descriptors";
import { resolvePorts } from "../../../../shared/scenario/node-descriptor";
import type { AutomationStatus } from "../../../../shared/dto";
import { newUuidV7 } from "../../../../shared/uuid-v7";

const NODE_WIDTH = 190;
const NODE_HEIGHT = 60;

const scenarioStatusOptions = [
  { value: "draft", label: "Черновик" },
  { value: "active", label: "Активен" },
  { value: "disabled", label: "Отключён" },
];

function starterGraph(): ScenarioGraph {
  const triggerId = newUuidV7();
  const resultId = newUuidV7();
  return scenarioGraphSchema.parse({
    nodes: [
      {
        id: triggerId,
        kind: "trigger.manual",
        name: "Ручной запуск",
        x: 80,
        y: 220,
        config:
          scenarioDescriptors.get("trigger.manual")?.defaultConfig?.() ?? {},
      },
      {
        id: resultId,
        kind: "output",
        name: "Результат",
        x: 460,
        y: 220,
        config: scenarioDescriptors.get("output")?.defaultConfig?.() ?? {},
      },
    ],
    edges: [
      {
        id: newUuidV7(),
        source: triggerId,
        sourcePort: "main",
        target: resultId,
        targetPort: "main",
      },
    ],
  });
}

export const ScenarioGraphEditorPage = observer(
  function ScenarioGraphEditorPage() {
    const { goTo, goBack } = useAppNavigation();
    const themeMode = useThemeMode();
    const toasts = useToasts();
    const { scenarioId } = useParams();
    const scenario = automationStore.getScenario(scenarioId);
    const initialGraph = useRef(
      scenario?.graph.nodes.length ? scenario.graph : starterGraph(),
    ).current;

    const [nodes, setNodes] = useState<ScenarioNode[]>(
      () => initialGraph.nodes,
    );
    const [edges, setEdges] = useState<ScenarioEdge[]>(
      () => initialGraph.edges,
    );
    const nodeNames = useMemo(() => nodes.map((node) => node.name), [nodes]);

    const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id ?? "");

    const summaryNames = useMemo(
      () => ({
        agents: new Map(
          automationStore.agents.map((agent) => [agent.id, agent.name]),
        ),
        vectorStores: new Map(
          vectorStoreStore.stores.map((store) => [store.id, store.name]),
        ),
        scenarios: new Map(
          automationStore.scenarios.map((item) => [item.id, item.name]),
        ),
        models: new Map(
          textProviderStore.models.map((model) => [model.id, model.name]),
        ),
      }),
      [
        automationStore.agents,
        automationStore.scenarios,
        vectorStoreStore.stores,
        textProviderStore.models,
      ],
    );

    const runVersion = automationStore.scenarioNodeRuns
      .map((run) => `${run.nodeId}:${run.status}`)
      .join("|");
    const expressionScope = useMemo<ExpressionScope>(() => {
      const runs = automationStore.scenarioNodeRuns;
      const nameById = new Map(nodes.map((node) => [node.id, node.name]));
      const runByNodeId = new Map(runs.map((run) => [run.nodeId, run]));
      const selectedRun = selectedNodeId
        ? runByNodeId.get(selectedNodeId)
        : undefined;

      const graph: ScenarioGraph = { ...emptyScenarioGraph(), nodes, edges };
      const triggerNode = nodes.find((node) =>
        node.kind.startsWith("trigger."),
      );

      const byName: Record<string, unknown> = {};
      for (const node of nodes)
        byName[node.name] = { json: inferNodeOutputShape(node.id, graph) };
      for (const run of runs) {
        const name = nameById.get(run.nodeId);
        if (name) byName[name] = { json: firstItem(run.output) };
      }
      const inferred = selectedNodeId
        ? inferIncomingShape(selectedNodeId, graph)
        : undefined;

      return {
        nodeNames,
        values: {
          $json: firstItem(selectedRun?.input) ?? inferred,
          $items: itemsOf(selectedRun?.input),
          $node: byName,
          $trigger:
            firstItem(automationStore.activeScenarioRun?.input) ??
            (triggerNode
              ? inferNodeOutputShape(triggerNode.id, graph)
              : undefined),
        },
      };
    }, [edges, nodeNames, nodes, runVersion, selectedNodeId]);
    const [status, setStatus] = useState<AutomationStatus>(
      scenario?.status ?? "draft",
    );
    const [scenarioName, setScenarioName] = useState(
      scenario?.name ?? "Новый сценарий",
    );
    const [isEditingName, setIsEditingName] = useState(false);
    const [showNodeDescriptions, setShowNodeDescriptions] = useState(true);
    const [nodeSearch, setNodeSearch] = useState("");
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
    const [pendingExit, setPendingExit] = useState(false);
    const [issues, setIssues] = useState<ScenarioValidationIssue[]>([]);
    const [generatingWithModel, setGeneratingWithModel] = useState(false);

    const history = useRef<
      Array<{ nodes: ScenarioNode[]; edges: ScenarioEdge[] }>
    >([]);
    const future = useRef<
      Array<{ nodes: ScenarioNode[]; edges: ScenarioEdge[] }>
    >([]);
    const pushHistory = useCallback(() => {
      history.current = [...history.current.slice(-49), { nodes, edges }];
      future.current = [];
    }, [nodes, edges]);
    const undo = useCallback(() => {
      const previous = history.current.pop();
      if (!previous) return;
      future.current = [...future.current, { nodes, edges }];
      setNodes(previous.nodes);
      setEdges(previous.edges);
    }, [nodes, edges]);
    const redo = useCallback(() => {
      const next = future.current.pop();
      if (!next) return;
      history.current = [...history.current, { nodes, edges }];
      setNodes(next.nodes);
      setEdges(next.edges);
    }, [nodes, edges]);

    useEffect(() => {
      if (scenario?.id) void automationStore.loadLastScenarioRun(scenario.id);
    }, [scenario?.id]);

    useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() === "z" && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if (
          event.key.toLowerCase() === "y" ||
          (event.key.toLowerCase() === "z" && event.shiftKey)
        ) {
          event.preventDefault();
          redo();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo]);

    useEffect(() => {
      if (!scenario) return;
      const localSnapshot = JSON.stringify({
        nodes,
        edges,
        name: scenarioName,
        status,
      });
      if (savedSnapshot !== null && savedSnapshot !== localSnapshot) {
        toasts.info({
          title: "Сценарий изменён моделью",
          description:
            "Есть несохранённые локальные правки — обновите вручную, чтобы не потерять их.",
        });
        return;
      }
      setNodes(scenario.graph.nodes);
      setEdges(scenario.graph.edges);
      setSelectedNodeId(scenario.graph.nodes[0]?.id ?? "");
      setStatus(scenario.status);
      setScenarioName(scenario.name);
      setIsEditingName(false);
      setSavedSnapshot(
        JSON.stringify({
          nodes: scenario.graph.nodes,
          edges: scenario.graph.edges,
          name: scenario.name,
          status: scenario.status,
        }),
      );
    }, [scenario]);

    const currentSnapshot = useMemo(
      () => JSON.stringify({ nodes, edges, name: scenarioName, status }),
      [nodes, edges, scenarioName, status],
    );
    const [initialSnapshot] = useState(() => currentSnapshot);
    const isDirty = (savedSnapshot ?? initialSnapshot) !== currentSnapshot;

    const nodesById = useMemo(
      () => new Map(nodes.map((node) => [node.id, node])),
      [nodes],
    );
    const selectedNode = nodesById.get(selectedNodeId);

    const issueByNode = useMemo(() => {
      const map = new Map<string, "error" | "warning">();
      for (const issue of issues) {
        if (!issue.nodeId) continue;
        if (issue.severity === "error" || !map.has(issue.nodeId))
          map.set(issue.nodeId, issue.severity);
      }
      return map;
    }, [issues]);

    const runStatusVersion = automationStore.scenarioNodeRuns
      .map((run) => `${run.nodeId}:${run.status}`)
      .join("|");
    const runStatusByNode = useMemo(
      () =>
        new Map(
          automationStore.scenarioNodeRuns.map((run) => [
            run.nodeId,
            run.status,
          ]),
        ),
      [runStatusVersion],
    );

    const deleteEdge = useCallback((edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    }, []);

    const deleteNode = useCallback((nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      );
      setSelectedNodeId((current) => (current === nodeId ? "" : current));
    }, []);

    const toggleNodeDisabled = useCallback((nodeId: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, disabled: !node.disabled } : node,
        ),
      );
    }, []);

    const updateSelectedNode = useCallback(
      (patch: Partial<ScenarioNode>) => {
        setNodes((current) =>
          current.map((node) =>
            node.id === selectedNodeId ? { ...node, ...patch } : node,
          ),
        );
      },
      [selectedNodeId],
    );

    const addNode = useCallback(
      (kind: string, position?: { x: number; y: number }) => {
        const descriptor = scenarioDescriptors.get(kind);
        if (!descriptor) return;
        pushHistory();
        const id = newUuidV7();
        setNodes((current) => [
          ...current,
          {
            id,
            kind,
            name: descriptor.label,
            description: "",
            x: position?.x ?? 420 + (current.length % 3) * 40,
            y: position?.y ?? 160 + (current.length % 4) * 96,
            config: (descriptor.defaultConfig?.() ??
              {}) as ScenarioNode["config"],
            runtime: {},
            disabled: false,
            notes: "",
            groupId: null,
          },
        ]);
        setSelectedNodeId(id);
      },
      [pushHistory],
    );

    const flowNodes = useMemo<ScenarioFlowNode[]>(
      () =>
        nodes.map((node) => ({
          id: node.id,
          type: "scenario" as const,
          position: { x: node.x, y: node.y },
          data: {
            node,
            summary: nodeSummary(node, summaryNames),
            showDescription: showNodeDescriptions,
            runStatus: runStatusByNode.get(node.id),
            issue: issueByNode.get(node.id),
            onDelete: deleteNode,
            onToggleDisabled: toggleNodeDisabled,
          },
          selected: node.id === selectedNodeId,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
        })),
      [
        nodes,
        selectedNodeId,
        showNodeDescriptions,
        runStatusByNode,
        issueByNode,
        deleteNode,
        toggleNodeDisabled,
      ],
    );

    const edgeColors = useMemo(
      () => ({
        main: readCssColor("--port-main"),
        knowledge: readCssColor("--port-knowledge"),
        error: readCssColor("--color-danger-medium"),
      }),
      [themeMode],
    );

    const flowEdges = useMemo<ScenarioFlowEdge[]>(
      () =>
        edges.map((edge) => {
          const source = nodesById.get(edge.source);
          const descriptor = source
            ? scenarioDescriptors.get(source.kind)
            : undefined;
          const port = descriptor
            ? resolvePorts(
                descriptor.outputs,
                (source?.config ?? {}) as Record<string, unknown>,
              ).find((item) => item.id === edge.sourcePort)
            : undefined;
          const isKnowledge = port?.dataKind === "knowledge";
          const isError = edge.sourcePort === "error";
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourcePort,
            targetHandle: edge.targetPort,
            type: "scenario" as const,
            animated: automationStore.activeScenarioRun?.status === "running",
            style: {
              stroke: isKnowledge
                ? edgeColors.knowledge
                : isError
                  ? edgeColors.error
                  : edgeColors.main,
              strokeWidth: 1.25,
              strokeDasharray: isKnowledge
                ? "1 5"
                : isError
                  ? "4 4"
                  : undefined,
              strokeLinecap: isKnowledge ? ("round" as const) : undefined,
            },
            data: {
              edgeId: edge.id,
              dataKind: isKnowledge
                ? ("knowledge" as const)
                : ("main" as const),
              onDelete: deleteEdge,
            },
          };
        }),
      [
        edges,
        nodesById,
        automationStore.activeScenarioRun?.status,
        deleteEdge,
        edgeColors,
      ],
    );

    const onNodesChange: OnNodesChange<ScenarioFlowNode> = useCallback(
      (changes) => {
        const removed = new Set(
          changes
            .filter((change) => change.type === "remove")
            .map((change) => change.id),
        );
        const positions = new Map(
          changes.flatMap((change) =>
            change.type === "position" && change.position
              ? [[change.id, change.position] as const]
              : [],
          ),
        );
        setNodes((current) =>
          current
            .filter((node) => !removed.has(node.id))
            .map((node) => {
              const position = positions.get(node.id);
              return position
                ? { ...node, x: position.x, y: position.y }
                : node;
            }),
        );
        if (removed.size)
          setEdges((current) =>
            current.filter(
              (edge) => !removed.has(edge.source) && !removed.has(edge.target),
            ),
          );
      },
      [],
    );

    const onEdgesChange: OnEdgesChange<ScenarioFlowEdge> = useCallback(
      (changes) => {
        const next = applyEdgeChanges(changes, flowEdges);
        setEdges(
          next.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourcePort: edge.sourceHandle ?? "main",
            targetPort: edge.targetHandle ?? "main",
          })),
        );
      },
      [flowEdges],
    );

    const onConnect = useCallback(
      (connection: Connection) => {
        if (!connection.source || !connection.target) return;
        pushHistory();
        setEdges((current) => {
          const duplicate = current.some(
            (edge) =>
              edge.source === connection.source &&
              edge.target === connection.target &&
              edge.sourcePort === (connection.sourceHandle ?? "main") &&
              edge.targetPort === (connection.targetHandle ?? "main"),
          );
          if (duplicate) return current;
          return [
            ...current,
            {
              id: newUuidV7(),
              source: connection.source!,
              sourcePort: connection.sourceHandle ?? "main",
              target: connection.target!,
              targetPort: connection.targetHandle ?? "main",
            },
          ];
        });
      },
      [pushHistory],
    );

    const buildGraph = useCallback(
      (): ScenarioGraph =>
        scenarioGraphSchema.parse({
          ...(scenario?.graph ?? emptyScenarioGraph()),
          nodes,
          edges,
        }),
      [nodes, edges, scenario],
    );

    const leaveEditor = useCallback(
      () => goBack(APP_PATHS.automation.scenarios.index),
      [goBack],
    );
    const requestExit = useCallback(() => {
      if (isDirty) setPendingExit(true);
      else leaveEditor();
    }, [isDirty, leaveEditor]);

    const saveScenario = async () => {
      try {
        const saved = await automationStore.upsertScenario({
          id: scenario?.id,
          name: scenarioName.trim() || "Новый сценарий",
          description: scenario?.description ?? "Сценарий автоматизации.",
          status,
          graph: buildGraph(),
          toolSettings: scenario?.toolSettings ?? [],
        });
        if (!scenarioId)
          goTo(
            APP_PATHS.automation.scenarios.edit.replace(
              ":scenarioId",
              saved.id,
            ),
            { replace: true },
          );
        setSavedSnapshot(currentSnapshot);
        toasts.success({ title: "Сценарий сохранён" });
        return saved;
      } catch (error) {
        toasts.danger({
          title: "Не удалось сохранить сценарий",
          description:
            error instanceof Error ? error.message : "Неизвестная ошибка",
        });
        return undefined;
      }
    };

    const validateScenario = async () => {
      const result = await automationStore.validateScenario(buildGraph());
      setIssues(result.issues);
      if (result.valid)
        toasts.success({
          title: "Граф готов к запуску",
          description: result.issues.length
            ? `Предупреждений: ${result.issues.length}`
            : undefined,
        });
      else
        toasts.danger({
          title: "Граф содержит ошибки",
          description: result.issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => issue.message)
            .join(" · "),
        });
      return result.valid;
    };

    const runScenario = async () => {
      if (!(await validateScenario())) return;
      const saved = await saveScenario();
      if (!saved) return;
      await automationStore.startScenario(saved.id, {
        message: "Ручной запуск сценария",
      });
      toasts.success({ title: "Сценарий запущен в фоне" });
    };

    const editorLaunchEnabled = nodes.some(
      (node) =>
        node.kind === "trigger.manual" &&
        !node.disabled &&
        (node.config as { fromEditor?: boolean }).fromEditor !== false,
    );

    const paletteGroups = useMemo(() => {
      const query = nodeSearch.trim().toLowerCase();
      return scenarioDescriptors
        .byCategory()
        .map((group) => ({
          ...group,
          items: group.items.filter((descriptor) =>
            `${descriptor.label} ${descriptor.description}`
              .toLowerCase()
              .includes(query),
          ),
        }))
        .filter((group) => group.items.length > 0);
    }, [nodeSearch]);

    const selectedVisual = selectedNode ? nodeVisual(selectedNode.kind) : null;
    const selectedDocumentation = selectedNode
      ? scenarioDescriptors.get(selectedNode.kind)?.documentation
      : undefined;
    const selectedIssues = issues.filter(
      (issue) => issue.nodeId === selectedNodeId,
    );

    return (
      <section
        data-tour="scenario-editor"
        className="flex h-full min-h-0 flex-col overflow-hidden bg-main-900"
      >
        <header
          data-tour="scenario-editor-header"
          className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-main-800 px-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              label="Назад"
              rounded="rounded-lg"
              className="size-7 shrink-0 p-0 text-main-400 hover:bg-main-600/50"
              onClick={requestExit}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-medium/10 text-accent-light">
              <RobotIcon className="size-4" />
            </span>
            <div className="min-w-0">
              {isEditingName ? (
                <InputSmall
                  autoFocus
                  value={scenarioName}
                  onChange={(event) => setScenarioName(event.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape")
                      setIsEditingName(false);
                  }}
                  className="w-72"
                />
              ) : (
                <button
                  type="button"
                  className="group flex items-center gap-2 text-left"
                  onClick={() => setIsEditingName(true)}
                >
                  <span className="truncate text-sm font-semibold text-main-100">
                    {scenarioName}
                  </span>
                  <EditIcon className="size-3.5 shrink-0 text-main-600 group-hover:text-main-300" />
                </button>
              )}
              <p className="mt-0.5 text-xs text-main-500">
                Узлов: {nodes.length} · связей: {edges.length}
                {isDirty ? " · есть несохранённые изменения" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={status}
              onChange={(next) => setStatus(next as AutomationStatus)}
              options={scenarioStatusOptions}
              className="w-40"
            >
              <Select.Trigger className="w-full" />
              <Select.Menu>
                {scenarioStatusOptions.map((option) => (
                  <Select.Option
                    key={option.value}
                    value={option.value}
                    label={option.label}
                  />
                ))}
              </Select.Menu>
            </Select>
            <Button
              className="gap-1.5 px-2"
              variant="ghost"
              onClick={() => void saveScenario()}
            >
              <SaveIcon className="size-4" />
              Сохранить
            </Button>
            <Button
              variant="secondary"
              className="px-2"
              onClick={() => void validateScenario()}
            >
              Проверить
            </Button>
            {editorLaunchEnabled ? (
              <Button
                variant="primary"
                className="gap-1.5 px-2"
                onClick={() => void runScenario()}
              >
                <SendIcon className="size-4" /> Запустить
              </Button>
            ) : null}
            <Button
              variant="tertiary"
              rounded="rounded-lg"
              title="Изменить сценарий с помощью модели"
              disabled={!scenarioId}
              onClick={() => {
                if (!scenarioId) {
                  toasts.danger({ title: "Сначала сохраните сценарий" });
                  return;
                }
                setGeneratingWithModel(true);
              }}
            >
              <CreationIcon />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <ResizableSidePanel
            dataTour="scenario-node-palette"
            title="Узлы"
            side="left"
            storageKey="zvs.scenario-editor.node-palette"
            defaultWidth={288}
            collapsedContent={
              <ScrollArea className="h-full min-h-0" showScrollbar={false}>
                <div className="flex flex-col items-center gap-1.5 py-2">
                  {paletteGroups.flatMap((group) =>
                    group.items.map((descriptor) => {
                      const visual = nodeVisual(descriptor.kind);
                      const Icon = visual.icon;
                      return (
                        <Tooltip
                          key={descriptor.kind}
                          label={descriptor.label}
                          placement="right-center"
                          className="block"
                        >
                          <button
                            type="button"
                            draggable
                            aria-label={descriptor.label}
                            onDragStart={(event) => {
                              event.dataTransfer.setData(
                                "application/scenario-node",
                                descriptor.kind,
                              );
                              event.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => addNode(descriptor.kind)}
                            className={`grid size-9 shrink-0 cursor-grab place-items-center rounded-lg transition active:cursor-grabbing ${visual.iconClassName}`}
                          >
                            <Icon className="size-4" />
                          </button>
                        </Tooltip>
                      );
                    }),
                  )}
                </div>
              </ScrollArea>
            }
          >
            <div className="flex h-full min-h-0 flex-col p-3">
              <InputCheckBox
                checked={showNodeDescriptions}
                onChange={setShowNodeDescriptions}
                className="mb-3 px-1 text-xs text-main-400"
              >
                Показывать описание при наведении
              </InputCheckBox>
              <InputSmall
                preset="search"
                placeholder="Поиск узлов"
                className="w-full"
                value={nodeSearch}
                onChange={(event) => setNodeSearch(event.target.value)}
              />

              <ScrollArea className="mt-3 min-h-0 flex-1">
                <div className="space-y-4 pr-1">
                  {paletteGroups.map((group) => (
                    <section key={group.category}>
                      <h3 className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-main-600">
                        {CATEGORY_LABELS[group.category] ?? group.category}
                      </h3>
                      <div className="space-y-1">
                        {group.items.map((descriptor) => {
                          const visual = nodeVisual(descriptor.kind);
                          const Icon = visual.icon;
                          return (
                            <button
                              key={descriptor.kind}
                              type="button"
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.setData(
                                  "application/scenario-node",
                                  descriptor.kind,
                                );
                                event.dataTransfer.effectAllowed = "copy";
                              }}
                              className="group flex w-full cursor-grab items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-main-800/70 active:cursor-grabbing"
                              onClick={() => addNode(descriptor.kind)}
                              title={
                                descriptor.documentation ??
                                descriptor.description
                              }
                            >
                              <span
                                className={`grid size-9 shrink-0 place-items-center rounded-lg ${visual.iconClassName}`}
                              >
                                <Icon className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-main-200">
                                  {descriptor.label}
                                </span>
                                <span className="block truncate text-xs text-main-500">
                                  {descriptor.description}
                                </span>
                              </span>
                              <PlusIcon className="size-3.5 shrink-0 text-main-600 group-hover:text-main-300" />
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-3 rounded-lg bg-main-800/35 p-3 text-[11px] leading-5 text-main-500">
                Перетащите узел на холст или нажмите на него. Ctrl+Z — отменить,
                Ctrl+Y — повторить.
              </div>
            </div>
          </ResizableSidePanel>

          <ScenarioGraphCanvas
            dataTour="scenario-canvas"
            key={scenario?.revisionId ?? "new-scenario"}
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeSelect={setSelectedNodeId}
            onDrop={(kind, position) => addNode(kind, position)}
          />

          <ResizableSidePanel
            dataTour="scenario-node-settings"
            title="Настройки"
            storageKey="zvs.scenario-editor.inspector"
            headerAction={<CogIcon className="size-4 shrink-0 text-main-500" />}
          >
            <ScrollArea className="max-h-full min-h-0">
              {selectedNode && selectedVisual ? (
                <div className="space-y-5 p-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid size-10 place-items-center rounded-lg ${selectedVisual.iconClassName}`}
                      >
                        <selectedVisual.icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-main-100">
                          {selectedVisual.label}
                        </p>
                        <p className="text-xs leading-4 text-main-500">
                          {selectedVisual.description}
                        </p>
                      </div>
                    </div>
                    {selectedDocumentation ? (
                      <p className="mt-3 rounded-lg bg-main-800/60 px-3 py-2 text-[11px] leading-4 text-main-400 ring-1 ring-main-700/60">
                        {selectedDocumentation}
                      </p>
                    ) : null}
                  </div>

                  {selectedIssues.length ? (
                    <ul className="space-y-1.5">
                      {selectedIssues.map((issue, index) => (
                        <li
                          key={index}
                          className={`rounded-lg px-3 py-2 text-xs leading-5 ${
                            issue.severity === "error"
                              ? "bg-danger-medium/10 text-danger-light"
                              : "bg-warning-medium/10 text-warning-light"
                          }`}
                        >
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium text-main-400">
                        Название
                      </span>
                      <InputSmall
                        value={selectedNode.name}
                        onChange={(event) =>
                          updateSelectedNode({ name: event.target.value })
                        }
                        className="w-full"
                      />
                    </label>
                    <InputCheckBox
                      checked={Boolean(selectedNode.disabled)}
                      onChange={() => toggleNodeDisabled(selectedNode.id)}
                      className="text-xs text-main-300"
                    >
                      <span className="flex items-center gap-1.5">
                        <BlockIcon className="size-3.5" />
                        Узел отключён
                      </span>
                    </InputCheckBox>
                  </div>

                  <div className="border-t border-main-800 pt-4">
                    <ExpressionScopeProvider scope={expressionScope}>
                      <DynamicNodeConfigForm
                        node={selectedNode}
                        onChange={updateSelectedNode}
                      />
                    </ExpressionScopeProvider>
                  </div>
                </div>
              ) : (
                <div className="grid h-48 place-items-center px-6 text-center text-sm text-main-500">
                  Выберите узел на графе
                </div>
              )}
            </ScrollArea>
          </ResizableSidePanel>
        </div>

        <DangerModal
          open={pendingExit}
          model={pendingExit}
          title="Выйти без сохранения?"
          description="В сценарии есть несохранённые изменения. Если выйти сейчас, они будут потеряны."
          confirmLabel="Выйти без сохранения"
          onCancel={() => setPendingExit(false)}
          onConfirm={() => {
            setPendingExit(false);
            leaveEditor();
          }}
        />
        <DangerModal
          open={automationStore.pendingScenarioApproval !== null}
          model={automationStore.pendingScenarioApproval}
          title="Продолжить сценарий?"
          description={(approval) => approval.prompt}
          confirmLabel="Продолжить"
          onCancel={() => void automationStore.approveScenarioRun(false)}
          onConfirm={() => automationStore.approveScenarioRun(true)}
        />

        <AIEntityCreateForm
          open={generatingWithModel}
          kind="scenario"
          entityId={scenarioId}
          onClose={() => setGeneratingWithModel(false)}
        />
      </section>
    );
  },
);

function firstItem(payload: unknown): unknown {
  const list = itemsOf(payload);
  if (list) return list[0];
  if (Array.isArray(payload)) return firstItem(payload[0]);
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if ("json" in record) return record.json;
  }
  return payload;
}

function itemsOf(payload: unknown): unknown[] | undefined {
  if (payload === null || payload === undefined) return undefined;
  if (Array.isArray(payload)) return unwrapItems(payload);
  if (typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) return unwrapItems(record.items);
  if ("json" in record) return [record.json];
  const port = portItems(record);
  return port ? unwrapItems(port) : undefined;
}

function portItems(record: Record<string, unknown>): unknown[] | undefined {
  const keys = Object.keys(record);
  if (keys.length === 0) return undefined;
  const bundles = keys.map((key) => record[key]);
  if (!bundles.every((value) => Array.isArray(value))) return undefined;
  const entries = bundles as unknown[][];
  if (!entries.flat().every((entry) => isItemEntry(entry))) return undefined;
  return (record.main as unknown[] | undefined) ?? entries[0];
}

function isItemEntry(entry: unknown): boolean {
  return (
    Boolean(entry) && typeof entry === "object" && "json" in (entry as object)
  );
}

function unwrapItems(list: unknown[]): unknown[] {
  return list.map((entry) =>
    isItemEntry(entry) ? (entry as { json: unknown }).json : entry,
  );
}
