import {
  type SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyEdgeChanges,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import {
  Button,
  InputCheckBox,
  InputSmall,
  ScrollArea,
  Select,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { useParams } from "react-router-dom";
import { observer } from "mobx-react-lite";
import {
  ChevronLeftIcon,
  EditIcon,
  PlusIcon,
  RobotIcon,
  SaveIcon,
  SendIcon,
  SettingsIcon,
  TasksIcon,
  StorageIcon,
  PlayCircleIcon,
  DownloadIcon,
  FileIcon,
} from "../../../components/atoms";
import {
  ScenarioGraphCanvas,
  type ScenarioFlowEdge,
  type ScenarioFlowNode,
} from "../../../components/organisms";
import {
  ScenarioChatTriggerSetupForm,
  ScenarioEditorTriggerSetupForm,
  ScenarioEmailTriggerSetupForm,
  ScenarioIntervalTriggerSetupForm,
  ScenarioTelegramTriggerSetupForm,
  ScenarioNodeAgentForm,
  ScenarioNodeApprovalForm,
  ScenarioNodeConditionForm,
  ScenarioNodeDownloadFilesForm,
  ScenarioNodeReadFilesForm,
  ScenarioNodeKnowledgeStoreForm,
  ScenarioNodeOrchestratorForm,
  ScenarioNodeOutputForm,
  ScenarioNodeTriggerForm,
} from "../../../components/organisms/forms";
import { getScenarioTriggerEventChannels } from "../../../components/molecules/nodes";
import { APP_PATHS } from "../../../app/routes";
import { useAppNavigation } from "../../../hooks";
import {
  automationStore,
  integrationStore,
  vectorStoreStore,
} from "../../../stores";
import type { AutomationScenarioNodeKind as NodeKind } from "../../../../ipc/contracts";
import { DangerModal, FormModal } from "@renderer/components/organisms/modals";
import { getScenarioEdgeKind } from "../../../../shared/scenario-ports";
import {
  automationScenarioEdgeDtoSchema,
  automationScenarioNodeDtoSchema,
  scenarioTriggerConfigDtoSchema,
  parseIpcDto,
  type AutomationScenarioEdge as GraphEdge,
  type AutomationScenarioNode as GraphNode,
  type AutomationStatus,
  type ScenarioTriggerConfig,
} from "../../../../shared/dto";

const defaultTriggerConfig: ScenarioTriggerConfig = {
  manual: { chatEnabled: true, editorEnabled: true },
  automatic: [],
};

const triggerConfigOf = (node?: GraphNode): ScenarioTriggerConfig => {
  const parsed = scenarioTriggerConfigDtoSchema.safeParse(
    node?.config?.trigger,
  );
  return parsed.success ? parsed.data : defaultTriggerConfig;
};

type AutomaticTrigger = ScenarioTriggerConfig["automatic"][number];
type TelegramTrigger = Extract<AutomaticTrigger, { kind: "telegram" }>;
type EmailTrigger = Extract<AutomaticTrigger, { kind: "email" }>;
type IntervalTrigger = Extract<AutomaticTrigger, { kind: "interval" }>;
type TriggerSetupModal =
  | { kind: "chat" }
  | { kind: "editor" }
  | { kind: "telegram" }
  | { kind: "email" }
  | { kind: "interval" };

const nodeMeta: Record<
  NodeKind,
  {
    label: string;
    color: string;
    dot: string;
    icon: (props: SVGProps<SVGSVGElement>) => React.ReactNode;
  }
> = {
  trigger: {
    label: "Триггер",
    color: "text-amber-200 bg-amber-400/10",
    dot: "bg-amber-300",
    icon: (props) => <PlayCircleIcon {...props} />,
  },
  orchestrator: {
    label: "Оркестратор",
    color: "text-violet-200 bg-violet-400/10",
    dot: "bg-violet-300",
    icon: (props) => <RobotIcon {...props} />,
  },
  agent: {
    label: "Агент",
    color: "text-violet-200 bg-violet-400/10",
    dot: "bg-violet-300",
    icon: (props) => <RobotIcon {...props} />,
  },
  knowledge_store: {
    label: "Хранилище",
    color: "text-cyan-200 bg-cyan-400/10",
    dot: "bg-cyan-300",
    icon: (props) => <StorageIcon {...props} />,
  },
  download_files: {
    label: "Скачать файлы",
    color: "text-pink-200 bg-pink-400/10",
    dot: "bg-pink-300",
    icon: (props) => <DownloadIcon {...props} />,
  },
  read_files: {
    label: "Читать файлы",
    color: "text-pink-200 bg-pink-400/10",
    dot: "bg-pink-300",
    icon: (props) => <FileIcon {...props} />,
  },
  condition: {
    label: "Условие",
    color: "text-sky-200 bg-sky-400/10",
    dot: "bg-sky-300",
    icon: (props) => <SettingsIcon {...props} />,
  },
  approval: {
    label: "Подтверждение",
    color: "text-lime-200 bg-lime-400/10",
    dot: "bg-lime-300",
    icon: (props) => <TasksIcon {...props} />,
  },
  output: {
    label: "Результат",
    color: "text-emerald-200 bg-emerald-400/10",
    dot: "bg-emerald-300",
    icon: (props) => <SendIcon {...props} />,
  },
};

const initialNodes: GraphNode[] = [
  {
    id: "trigger",
    kind: "trigger",
    title: "Начало",
    description: "Вход в сценарий",
    x: 70,
    y: 250,
    config: { trigger: defaultTriggerConfig },
  },
  {
    id: "orchestrator",
    kind: "orchestrator",
    title: "Оркестратор",
    description: "Анализирует задачу",
    x: 330,
    y: 250,
  },
  {
    id: "response",
    kind: "output",
    title: "Ответ пользователю",
    description: "Возвращает результат",
    x: 590,
    y: 250,
  },
];

type PaletteItem = { kind: NodeKind; title: string; description: string };
const paletteGroups: Array<{ label: string; items: PaletteItem[] }> = [
  {
    label: "Исполнение",
    items: [
      {
        kind: "agent",
        title: "Вызов агента",
        description: "Делегирование задачи",
      },
      {
        kind: "condition",
        title: "Условие",
        description: "Выбор следующей ветки",
      },
      {
        kind: "approval",
        title: "Подтверждение",
        description: "Решение пользователя",
      },
    ],
  },
  {
    label: "Данные и файлы",
    items: [
      {
        kind: "knowledge_store",
        title: "База знаний",
        description: "Контекст для агента",
      },
      {
        kind: "download_files",
        title: "Скачать файлы",
        description: "Сохраняет вложения запуска",
      },
      {
        kind: "read_files",
        title: "Читать файлы",
        description: "Преобразует TXT и Markdown в текст",
      },
    ],
  },
];

const scenarioStatusOptions = [
  { value: "draft", label: "Черновик" },
  { value: "active", label: "Активен" },
  { value: "disabled", label: "Отключён" },
];

export const ScenarioGraphEditorPage = observer(
  function ScenarioGraphEditorPage() {
    const { goTo, goBack } = useAppNavigation();
    const toasts = useToasts();
    const { scenarioId } = useParams();
    const scenario = automationStore.getScenario(scenarioId);
    const [nodes, setNodes] = useState<GraphNode[]>(() =>
      scenario?.graph.nodes.length
        ? parseIpcDto(
            automationScenarioNodeDtoSchema.array(),
            scenario.graph.nodes,
          )
        : initialNodes,
    );
    const [edges, setEdges] = useState<GraphEdge[]>(() =>
      scenario
        ? parseIpcDto(
            automationScenarioEdgeDtoSchema.array(),
            scenario.graph.edges,
          )
        : [],
    );
    const [selectedNodeId, setSelectedNodeId] = useState("orchestrator");
    const [status, setStatus] = useState<AutomationStatus>(
      scenario?.status ?? "draft",
    );
    const [scenarioName, setScenarioName] = useState(
      scenario?.name ?? "Новый сценарий",
    );
    const [isEditingName, setIsEditingName] = useState(false);
    const nameBeforeEdit = useRef(scenarioName);
    const cancelNameEdit = useRef(false);
    const [showNodeDescriptions, setShowNodeDescriptions] = useState(true);
    const [nodeSearch, setNodeSearch] = useState("");
    const [triggerSetupModal, setTriggerSetupModal] =
      useState<TriggerSetupModal | null>(null);
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
    const [pendingExit, setPendingExit] = useState(false);

    useEffect(() => {
      if (!scenario) return;
      const loadedNodes = parseIpcDto(
        automationScenarioNodeDtoSchema.array(),
        scenario.graph.nodes,
      );
      const loadedEdges = parseIpcDto(
        automationScenarioEdgeDtoSchema.array(),
        scenario.graph.edges,
      );
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setSelectedNodeId(scenario.graph.nodes[0]?.id ?? "");
      setStatus(scenario.status);
      setScenarioName(scenario.name);
      setIsEditingName(false);
      setSavedSnapshot(
        JSON.stringify({
          nodes: loadedNodes,
          edges: loadedEdges,
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
    const selectedTriggerConfig = triggerConfigOf(selectedNode);
    const scenarioTriggerConfig = triggerConfigOf(
      nodes.find((node) => node.kind === "trigger"),
    );
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

    const flowNodes = useMemo<ScenarioFlowNode[]>(
      () =>
        nodes.map((node) => {
          const eventChannelCount =
            node.kind === "trigger"
              ? getScenarioTriggerEventChannels(node).length
              : 0;
          const width = 176;
          const height = eventChannelCount ? 68 + eventChannelCount * 35 : 60;
          return {
            id: node.id,
            type: "scenario",
            position: { x: node.x, y: node.y },
            data: {
              node,
              showDescription: showNodeDescriptions,
              runStatus: runStatusByNode.get(node.id),
              onDelete:
                node.kind === "trigger" ||
                node.kind === "orchestrator" ||
                node.kind === "output"
                  ? undefined
                  : deleteNode,
            },
            selected: node.id === selectedNodeId,
            deletable:
              node.kind !== "trigger" &&
              node.kind !== "orchestrator" &&
              node.kind !== "output",
            width,
            height,
            measured: { width, height },
          };
        }),
      [
        nodes,
        selectedNodeId,
        showNodeDescriptions,
        runStatusByNode,
        deleteNode,
      ],
    );
    const flowEdges = useMemo<ScenarioFlowEdge[]>(
      () =>
        edges.map((edge) => ({
          ...edge,
          sourceHandle: edge.sourcePort,
          targetHandle: edge.targetPort,
          type: "scenario",
          animated: automationStore.activeScenarioRun?.status === "running",
          style: {
            stroke:
              edge.kind === "knowledge"
                ? "rgb(70 160 175)"
                : edge.kind === "files"
                  ? "rgb(236 72 153)"
                  : edge.kind === "text"
                    ? "rgb(139 173 77)"
                    : edge.kind === "worker"
                      ? "rgb(139 128 190)"
                      : "rgb(139 173 77)",
            strokeWidth: 1.25,
            strokeDasharray:
              edge.kind === "knowledge"
                ? "1 5"
                : edge.kind === "files"
                  ? "1 5"
                  : edge.kind === "text"
                    ? undefined
                    : edge.kind === "worker"
                      ? "4 4"
                      : undefined,
            strokeLinecap:
              edge.kind === "knowledge" || edge.kind === "files"
                ? "round"
                : undefined,
          },
          data: {
            edgeId: edge.id,
            kind: edge.kind,
            onDelete: deleteEdge,
          },
        })),
      [edges, automationStore.activeScenarioRun?.status, deleteEdge],
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
            kind: edge.data?.kind ?? "text",
            sourcePort: edge.sourceHandle ?? undefined,
            targetPort: edge.targetHandle ?? undefined,
          })),
        );
      },
      [flowEdges],
    );
    const onConnect = useCallback((connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const kind = getScenarioEdgeKind(connection.sourceHandle);
      if (!kind) return;
      setEdges((current) => {
        if (
          current.some(
            (edge) =>
              edge.source === connection.source &&
              edge.target === connection.target &&
              edge.kind === kind &&
              edge.sourcePort === (connection.sourceHandle ?? undefined),
          )
        )
          return current;
        return [
          ...current,
          {
            id: `edge-${crypto.randomUUID()}`,
            source: connection.source!,
            target: connection.target!,
            kind,
            sourcePort: connection.sourceHandle ?? undefined,
            targetPort: connection.targetHandle ?? undefined,
          },
        ];
      });
    }, []);

    const addNode = (kind: NodeKind, title: string) => {
      const id = `${kind}-${crypto.randomUUID()}`;
      setNodes((current) => [
        ...current,
        {
          id,
          kind,
          title,
          description: "Настройте новый узел",
          x: 410 + (current.length % 3) * 36,
          y: 170 + (current.length % 4) * 92,
          config:
            kind === "download_files"
              ? { cleanupOnFinish: true, maxFileSizeMb: 50 }
              : kind === "read_files"
                ? { maxCharactersPerFile: 100000 }
                : undefined,
        },
      ]);
      setSelectedNodeId(id);
    };

    const updateSelectedNode = (patch: Partial<GraphNode>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId ? { ...node, ...patch } : node,
        ),
      );
    };
    const updateTriggerConfig = (next: ScenarioTriggerConfig) =>
      updateSelectedNode({
        config: { ...selectedNode?.config, trigger: next },
      });
    const saveAutomaticTriggers = (
      kind: AutomaticTrigger["kind"],
      bindings: AutomaticTrigger[],
    ) => {
      updateTriggerConfig({
        ...selectedTriggerConfig,
        automatic: [
          ...selectedTriggerConfig.automatic.filter(
            (item) => item.kind !== kind,
          ),
          ...bindings,
        ],
      });
    };
    const editorLaunchEnabled = Boolean(
      scenario &&
      status !== "disabled" &&
      triggerConfigOf(nodes.find((node) => node.kind === "trigger")).manual
        .editorEnabled,
    );

    useEffect(() => {
      if (!isDirty) return;
      const guard = (event: BeforeUnloadEvent) => event.preventDefault();
      window.addEventListener("beforeunload", guard);
      return () => window.removeEventListener("beforeunload", guard);
    }, [isDirty]);

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
          description:
            scenario?.description ??
            "Новый сценарий автоматизации с вызовом агентов.",
          status,
          graph: {
            nodes,
            edges,
            viewport: scenario?.graph.viewport ?? { x: 0, y: 0, zoom: 1 },
          },
          toolSettings: scenario?.toolSettings ?? [],
        });
        if (!scenarioId) {
          goTo(
            APP_PATHS.automation.scenarios.edit.replace(
              ":scenarioId",
              saved.id,
            ),
            { replace: true },
          );
        }
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
      const result = await automationStore.validateScenario({ nodes, edges });
      if (result.valid) toasts.success({ title: "Граф готов к запуску" });
      else
        toasts.danger({
          title: "Граф содержит ошибки",
          description: result.issues.map((issue) => issue.message).join(" · "),
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

    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-main-900">
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-main-800 px-4">
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
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-400/10 text-violet-200">
              <RobotIcon className="size-4" />
            </span>
            <div className="min-w-0 flex gap-3">
              {isEditingName ? (
                <InputSmall
                  autoFocus
                  aria-label="Название сценария"
                  value={scenarioName}
                  className="h-7 w-64"
                  onChange={(event) => setScenarioName(event.target.value)}
                  onBlur={() => {
                    if (cancelNameEdit.current) {
                      cancelNameEdit.current = false;
                      setScenarioName(nameBeforeEdit.current);
                      setIsEditingName(false);
                      return;
                    }
                    setScenarioName(
                      (value) => value.trim() || nameBeforeEdit.current,
                    );
                    setIsEditingName(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") {
                      cancelNameEdit.current = true;
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="group/name flex min-w-0 max-w-64 items-center gap-3 rounded-md border-0 bg-transparent px-1.5 py-1 text-left transition-colors hover:bg-main-800"
                  aria-label="Изменить название сценария"
                  onClick={() => {
                    nameBeforeEdit.current = scenarioName;
                    setIsEditingName(true);
                  }}
                >
                  <span className="truncate text-sm font-semibold text-main-100">
                    {scenarioName}
                  </span>
                  <EditIcon className="size-3.5 shrink-0 text-main-400 opacity-0 transition-opacity group-hover/name:opacity-100" />
                </button>
              )}
              <Select
                className="w-30 shrink-0"
                value={status}
                onChange={(value) => setStatus(value as AutomationStatus)}
                options={scenarioStatusOptions}
              >
                <Select.Trigger
                  rounded="rounded-full"
                  className="h-7 w-full border-0! bg-main-800/80 px-2.5 text-[11px] shadow-none ring-0! hover:bg-main-700"
                />
                <Select.Menu rounded="rounded-3xl">
                  {scenarioStatusOptions.map((option) => (
                    <Select.Option key={option.value} {...option} />
                  ))}
                </Select.Menu>
              </Select>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button
                className="px-2"
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
                  className="px-2"
                  onClick={() => void runScenario()}
                >
                  <SendIcon className="size-4" /> Запустить
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col border-r border-main-800 bg-main-900/80 p-3">
            <InputCheckBox
              checked={showNodeDescriptions}
              onChange={setShowNodeDescriptions}
              className="mb-3 px-1 text-xs text-main-400"
            >
              Показывать описание при наведении
            </InputCheckBox>
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-main-500 mb-3">
              Узлы
            </h2>
            <InputSmall
              preset="search"
              placeholder="Поиск узлов"
              className="w-full"
              value={nodeSearch}
              onChange={(event) => setNodeSearch(event.target.value)}
            />

            <div className="mt-4 space-y-4 overflow-auto">
              {paletteGroups.map((group) => {
                const query = nodeSearch.trim().toLowerCase();
                const items = group.items.filter((item) =>
                  `${item.title} ${item.description}`
                    .toLowerCase()
                    .includes(query),
                );
                if (!items.length) return null;
                return (
                  <section key={group.label}>
                    <h3 className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-main-600">
                      {group.label}
                    </h3>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const meta = nodeMeta[item.kind];
                        return (
                          <button
                            key={item.kind}
                            type="button"
                            className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-main-800/70"
                            onClick={() => addNode(item.kind, item.title)}
                          >
                            <span
                              className={`grid size-9 shrink-0 place-items-center rounded-lg ${meta.color}`}
                            >
                              {meta.icon({ className: "size-4" })}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-main-200">
                                {item.title}
                              </span>
                              <span className="block truncate text-xs text-main-500">
                                {item.description}
                              </span>
                            </span>
                            <PlusIcon className="size-3.5 text-main-600 group-hover:text-main-300" />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="mt-auto rounded-lg bg-main-800/35 p-3 text-xs leading-5 text-main-500">
              Выберите узел для настройки. Перетаскивайте узлы по рабочей
              области.
            </div>
          </aside>

          <ScenarioGraphCanvas
            key={scenario?.revisionId ?? "new-scenario"}
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeSelect={setSelectedNodeId}
          />

          <aside className="w-96 shrink-0 border-l border-main-800 bg-main-900/90">
            <ScrollArea className="min-h-0 max-h-full">
              <div className="flex h-12 items-center justify-between border-b border-main-800 px-4">
                <h2 className="text-sm font-semibold text-main-200">
                  Настройки
                </h2>
                <SettingsIcon className="size-4 text-main-500" />
              </div>
              {selectedNode ? (
                <div className="space-y-5 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-10 place-items-center rounded-lg ${nodeMeta[selectedNode.kind].color}`}
                    >
                      {nodeMeta[selectedNode.kind].icon({
                        className: "size-4",
                      })}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-main-100">
                        {nodeMeta[selectedNode.kind].label}
                      </p>
                      <p className="text-xs text-main-500">{selectedNode.id}</p>
                    </div>
                  </div>

                  {selectedNode.kind === "trigger" ? (
                    <ScenarioNodeTriggerForm
                      config={selectedTriggerConfig}
                      onSetup={(kind) => setTriggerSetupModal({ kind })}
                    />
                  ) : null}
                  {selectedNode.kind === "agent" ? (
                    <ScenarioNodeAgentForm
                      node={selectedNode}
                      agents={automationStore.agents}
                      onChange={updateSelectedNode}
                    />
                  ) : null}
                  {selectedNode.kind === "knowledge_store" ? (
                    <ScenarioNodeKnowledgeStoreForm
                      node={selectedNode}
                      stores={vectorStoreStore.stores}
                      onChange={updateSelectedNode}
                    />
                  ) : null}
                  {selectedNode.kind === "orchestrator" ? (
                    <ScenarioNodeOrchestratorForm
                      node={selectedNode}
                      onChange={updateSelectedNode}
                    />
                  ) : null}
                  {selectedNode.kind === "condition" ? (
                    <ScenarioNodeConditionForm
                      node={selectedNode}
                      onChange={updateSelectedNode}
                    />
                  ) : null}
                  {selectedNode.kind === "download_files" ? (
                    <ScenarioNodeDownloadFilesForm
                      node={selectedNode}
                      onChange={updateSelectedNode}
                    />
                  ) : null}
                  {selectedNode.kind === "read_files" ? (
                    <ScenarioNodeReadFilesForm
                      node={selectedNode}
                      onChange={updateSelectedNode}
                    />
                  ) : null}
                  {selectedNode.kind === "approval" ? (
                    <ScenarioNodeApprovalForm
                      node={selectedNode}
                      onChange={updateSelectedNode}
                    />
                  ) : null}
                  {selectedNode.kind === "output" ? (
                    <ScenarioNodeOutputForm
                      node={selectedNode}
                      onChange={updateSelectedNode}
                      triggerConfig={scenarioTriggerConfig}
                      profiles={integrationStore.profiles}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="grid h-48 place-items-center px-6 text-center text-sm text-main-500">
                  Выберите узел на графе
                </div>
              )}
              {automationStore.activeScenarioRun ? (
                <div className="m-4 rounded-lg bg-main-800/55 p-3 text-xs text-main-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      Запуск #{automationStore.activeScenarioRun.id}
                    </span>
                    <span className="text-main-500">
                      {automationStore.activeScenarioRun.status}
                    </span>
                  </div>
                  <p className="mt-2 text-main-500">
                    Выполнено узлов:{" "}
                    {
                      automationStore.scenarioNodeRuns.filter(
                        (item) => item.status === "completed",
                      ).length
                    }
                  </p>
                </div>
              ) : null}
            </ScrollArea>
          </aside>
        </div>
        <FormModal
          open={triggerSetupModal?.kind === "chat"}
          model={selectedTriggerConfig.manual.chatEnabled}
          form={{
            component: ScenarioChatTriggerSetupForm,
            title: "Запуск из чата",
            props: {
              onSubmit: (chatEnabled: boolean) =>
                updateTriggerConfig({
                  ...selectedTriggerConfig,
                  manual: { ...selectedTriggerConfig.manual, chatEnabled },
                }),
            },
          }}
          onConfirm={() => setTriggerSetupModal(null)}
          onCancel={() => setTriggerSetupModal(null)}
        />
        <FormModal
          open={triggerSetupModal?.kind === "editor"}
          model={selectedTriggerConfig.manual.editorEnabled}
          form={{
            component: ScenarioEditorTriggerSetupForm,
            title: "Запуск из окна сценария",
            props: {
              onSubmit: (editorEnabled: boolean) =>
                updateTriggerConfig({
                  ...selectedTriggerConfig,
                  manual: { ...selectedTriggerConfig.manual, editorEnabled },
                }),
            },
          }}
          onConfirm={() => setTriggerSetupModal(null)}
          onCancel={() => setTriggerSetupModal(null)}
        />
        <FormModal
          open={triggerSetupModal?.kind === "telegram"}
          model={selectedTriggerConfig.automatic.filter(
            (item): item is TelegramTrigger => item.kind === "telegram",
          )}
          form={{
            component: ScenarioTelegramTriggerSetupForm,
            title: "Сообщение в Telegram",
            className: "max-w-3xl",
            props: {
              profiles: integrationStore.profiles.filter(
                (item) => item.kind === "telegram_bot",
              ),
              onSubmit: (items: TelegramTrigger[]) =>
                saveAutomaticTriggers("telegram", items),
            },
          }}
          onConfirm={() => setTriggerSetupModal(null)}
          onCancel={() => setTriggerSetupModal(null)}
        />
        <FormModal
          open={triggerSetupModal?.kind === "email"}
          model={selectedTriggerConfig.automatic.filter(
            (item): item is EmailTrigger => item.kind === "email",
          )}
          form={{
            component: ScenarioEmailTriggerSetupForm,
            title: "Сообщение на почту",
            className: "max-w-3xl",
            props: {
              profiles: integrationStore.profiles.filter(
                (item) => item.kind === "email_imap",
              ),
              onSubmit: (items: EmailTrigger[]) =>
                saveAutomaticTriggers("email", items),
            },
          }}
          onConfirm={() => setTriggerSetupModal(null)}
          onCancel={() => setTriggerSetupModal(null)}
        />
        <FormModal
          open={triggerSetupModal?.kind === "interval"}
          model={selectedTriggerConfig.automatic.filter(
            (item): item is IntervalTrigger => item.kind === "interval",
          )}
          form={{
            component: ScenarioIntervalTriggerSetupForm,
            title: "Запуск по интервалу",
            className: "max-w-3xl",
            props: {
              onSubmit: (items: IntervalTrigger[]) =>
                saveAutomaticTriggers("interval", items),
            },
          }}
          onConfirm={() => setTriggerSetupModal(null)}
          onCancel={() => setTriggerSetupModal(null)}
        />
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
      </section>
    );
  },
);
